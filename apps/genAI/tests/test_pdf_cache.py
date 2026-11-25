from concurrent.futures import Future, ThreadPoolExecutor
from threading import Event, Lock

import pytest

from app.rag import rag_system as rag
from tests.conftest import SAMPLE_PDF, KeywordEmbeddings, make_pdf


class CountingEmbeddings(KeywordEmbeddings):
    def __init__(self):
        self.calls = []

    def embed_documents(self, texts):
        self.calls.append(list(texts))
        return super().embed_documents(texts)


@pytest.fixture
def embeddings(monkeypatch):
    model = CountingEmbeddings()
    monkeypatch.setattr(rag, "get_embeddings", lambda: model)
    return model


def upload(tmp_path, name="first.pdf", content=SAMPLE_PDF):
    path = tmp_path / name
    path.write_bytes(content)
    return str(path)


def test_renamed_upload_reuses_vectors_but_not_source_or_mutable_records(tmp_path, embeddings):
    first = upload(tmp_path)
    renamed = upload(tmp_path, "renamed.pdf")
    a = rag.create_pdf_vectorstore(first)
    b = rag.create_pdf_vectorstore(renamed)

    assert len(embeddings.calls) == 1
    assert a is not b
    assert a.similarity_search("light")[0].metadata["source"] == first
    assert b.similarity_search("light")[0].metadata["source"] == renamed
    record = next(iter(a.store.values()))
    record["metadata"]["page"] = 999
    record["vector"][0] = 999
    record["text"] = "changed by one caller"
    a.delete(list(a.store))
    (tmp_path / "first.pdf").unlink()
    fresh = rag.create_pdf_vectorstore(renamed)
    result = fresh.similarity_search("light")[0]
    assert result.metadata == {"source": renamed, "page": 0}
    assert "Photosynthesis" in result.page_content
    assert next(iter(fresh.store.values()))["vector"][0] != 999
    assert all("source" not in item["metadata"] for store in rag._pdf_cache.values()
               for item in store.store.values())


def test_changed_contents_at_same_path_build_again(tmp_path, embeddings):
    path = upload(tmp_path)
    rag.create_pdf_vectorstore(path)
    upload(tmp_path, content=make_pdf("A different document about cell energy."))
    changed = rag.create_pdf_vectorstore(path)
    assert len(embeddings.calls) == 2
    assert "different document" in changed.similarity_search("cell")[0].page_content


def test_model_and_chunk_configuration_are_part_of_key(tmp_path, embeddings, monkeypatch):
    path = upload(tmp_path)
    rag.create_pdf_vectorstore(path)
    monkeypatch.setattr(rag, "EMBEDDING_MODEL", "another-model-revision")
    rag.create_pdf_vectorstore(path)
    monkeypatch.setattr(rag, "PDF_CHUNK_SIZE", 500)
    rag.create_pdf_vectorstore(path)
    monkeypatch.setattr(rag, "PDF_CHUNK_OVERLAP", 100)
    rag.create_pdf_vectorstore(path)
    assert len(embeddings.calls) == 4


def test_hash_and_parser_use_same_file_snapshot(tmp_path, embeddings, monkeypatch):
    path = upload(tmp_path)
    original_loader = rag.load_pdf_chunks

    def replace_before_parse(*args, **kwargs):
        upload(tmp_path, content=make_pdf("Replacement text about the cell."))
        return original_loader(*args, **kwargs)

    monkeypatch.setattr(rag, "load_pdf_chunks", replace_before_parse)
    original = rag.create_pdf_vectorstore(path)
    assert "Photosynthesis" in original.similarity_search("light")[0].page_content
    replaced = rag.create_pdf_vectorstore(path)
    assert "Replacement text" in replaced.similarity_search("cell")[0].page_content
    assert len(embeddings.calls) == 2


def test_lru_eviction_keeps_recently_used_document(tmp_path, embeddings, monkeypatch):
    monkeypatch.setattr(rag, "PDF_CACHE_MAX_ENTRIES", 2)
    paths = [upload(tmp_path, f"{i}.pdf", make_pdf(f"Document {i} about light."))
             for i in range(3)]
    for path in [paths[0], paths[1], paths[0], paths[2], paths[0]]:
        rag.create_pdf_vectorstore(path)
    assert len(embeddings.calls) == 3
    assert len(rag._pdf_cache) == 2
    rag.create_pdf_vectorstore(paths[1])
    assert len(embeddings.calls) == 4
    assert len(rag._pdf_cache) == 2


def test_total_chunk_budget_evicts_across_distinct_uploads(tmp_path, embeddings, monkeypatch):
    monkeypatch.setattr(rag, "PDF_CACHE_MAX_CHUNKS", 2)
    for i in range(8):
        path = upload(tmp_path, f"{i}.pdf", make_pdf(f"Document {i} about light."))
        rag.create_pdf_vectorstore(path)
        assert sum(len(store.store) for store in rag._pdf_cache.values()) <= 2
    assert len(embeddings.calls) == 8
    assert len(rag._pdf_cache) == 2


def test_oversized_store_is_served_without_retention(tmp_path, embeddings, monkeypatch):
    monkeypatch.setattr(rag, "PDF_CACHE_MAX_CHUNKS", 1)
    small = upload(tmp_path)
    rag.create_pdf_vectorstore(small)
    large = upload(tmp_path, "large.pdf", make_pdf(*["Photosynthesis and cell energy. " * 20] * 8))
    for _ in range(2):
        assert len(rag.create_pdf_vectorstore(large).store) > 1
    rag.create_pdf_vectorstore(small)
    assert len(embeddings.calls) == 3
    assert len(rag._pdf_cache) == 1


def test_concurrent_misses_share_build_even_if_another_pdf_evicts(
    tmp_path, embeddings, monkeypatch
):
    monkeypatch.setattr(rag, "PDF_CACHE_MAX_ENTRIES", 1)
    entered, release, waiting = Event(), Event(), Event()
    original_embed = embeddings.embed_documents

    class WaitingFuture(Future):
        def result(self, timeout=None):
            waiting.set()
            return super().result(timeout)

    def blocked_embed(texts):
        if "Photosynthesis" in texts[0]:
            entered.set()
            assert release.wait(5)
        return original_embed(texts)

    monkeypatch.setattr(rag, "Future", WaitingFuture)
    monkeypatch.setattr(embeddings, "embed_documents", blocked_embed)
    a = upload(tmp_path)
    renamed = upload(tmp_path, "renamed.pdf")
    b = upload(tmp_path, "other.pdf", make_pdf("A cell in another document."))
    with ThreadPoolExecutor(max_workers=3) as pool:
        owner = pool.submit(rag.create_pdf_vectorstore, a)
        try:
            assert entered.wait(5)
            follower = pool.submit(rag.create_pdf_vectorstore, renamed)
            assert waiting.wait(5)
            rag.create_pdf_vectorstore(b)
        finally:
            release.set()
        first, second = owner.result(5), follower.result(5)
    assert len(embeddings.calls) == 2
    assert first.similarity_search("light")[0].metadata["source"] == a
    assert second.similarity_search("light")[0].metadata["source"] == renamed
    assert len(rag._pdf_cache) == 1
    assert rag._pdf_inflight == {}


def test_failed_build_releases_waiters_and_can_retry(tmp_path, embeddings, monkeypatch):
    entered, release, waiting = Event(), Event(), Event()
    original_embed = embeddings.embed_documents

    class WaitingFuture(Future):
        def result(self, timeout=None):
            waiting.set()
            return super().result(timeout)

    def fail_once(texts):
        entered.set()
        assert release.wait(5)
        raise RuntimeError("embedding unavailable")

    monkeypatch.setattr(rag, "Future", WaitingFuture)
    monkeypatch.setattr(embeddings, "embed_documents", fail_once)
    path = upload(tmp_path)
    with ThreadPoolExecutor(max_workers=2) as pool:
        owner = pool.submit(rag.create_pdf_vectorstore, path)
        try:
            assert entered.wait(5)
            follower = pool.submit(rag.create_pdf_vectorstore, path)
            assert waiting.wait(5)
        finally:
            release.set()
        for task in [owner, follower]:
            with pytest.raises(RuntimeError, match="embedding unavailable"):
                task.result(5)
    assert rag._pdf_inflight == {}
    assert rag._pdf_cache == {}
    monkeypatch.setattr(embeddings, "embed_documents", original_embed)
    assert rag.create_pdf_vectorstore(path).similarity_search("light")
    assert len(embeddings.calls) == 1


def test_cold_embedding_model_is_initialized_once(monkeypatch):
    monkeypatch.setattr(rag, "_embeddings", None)
    builds, guard = [], Lock()

    def build(model_name):
        with guard:
            builds.append(model_name)
        return KeywordEmbeddings()

    monkeypatch.setattr(rag, "FastEmbedEmbeddings", build)
    with ThreadPoolExecutor(max_workers=8) as pool:
        models = list(pool.map(lambda _: rag.get_embeddings(), range(20)))
    assert builds == [rag.EMBEDDING_MODEL]
    assert all(model is models[0] for model in models)


def test_missing_and_invalid_files_do_not_leave_cache_entries(tmp_path, embeddings):
    with pytest.raises(rag.PdfUnreadable):
        rag.create_pdf_vectorstore(str(tmp_path / "missing.pdf"))
    with pytest.raises(rag.PdfUnreadable):
        rag.create_pdf_vectorstore(upload(tmp_path, content=b"not a PDF"))
    assert rag._pdf_cache == {}
    assert rag._pdf_inflight == {}
    assert embeddings.calls == []


def test_repeated_http_uploads_reuse_embeddings_and_remove_temp_files(
    client, groq, upload_dir, embeddings
):
    for name in ["first.pdf", "renamed.pdf"]:
        response = client.post(
            "/ask-pdf", files={"file": (name, SAMPLE_PDF, "application/pdf")},
            data={"user_query": "What is photosynthesis?"},
        )
        assert response.status_code == 200
        assert response.json()["filename"] == name
        assert list(upload_dir.iterdir()) == []
    assert len(embeddings.calls) == 1
    assert len(groq.prompts) == 2
