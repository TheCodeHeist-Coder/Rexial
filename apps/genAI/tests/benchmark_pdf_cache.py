"""Opt-in real CPU embedding benchmark: python -m tests.benchmark_pdf_cache.

Downloads the configured fastembed model if absent. No LLM/API key is used.
Times PDF -> vector store only, with model initialization/warmup excluded.
"""

import hashlib
import json
import platform
import tempfile
from pathlib import Path
from time import perf_counter
from unittest.mock import patch

from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import InMemoryVectorStore

from app.rag import rag_system as rag
from tests.conftest import make_pdf


class CountedEmbeddings(Embeddings):
    def __init__(self, delegate):
        self.delegate = delegate
        self.document_calls = 0

    def embed_documents(self, texts):
        self.document_calls += 1
        return self.delegate.embed_documents(texts)

    def embed_query(self, text):
        return self.delegate.embed_query(text)


def main():
    model = rag.get_embeddings()
    model.embed_documents(["Warm up the CPU embedding model."])
    counted = CountedEmbeddings(model)
    pdf = make_pdf(*[
        f"Section {i}: Photosynthesis converts light energy; cells retain chemical energy. " * 8
        for i in range(30)
    ])
    report = {
        "model": rag.EMBEDDING_MODEL, "python": platform.python_version(),
        "machine": platform.machine(), "pdfBytes": len(pdf),
        "pdfSha256": hashlib.sha256(pdf).hexdigest(),
        "scope": (
            "Real CPU PDF parsing/chunking/embedding/store; excludes LLM, model load and warmup."
        ),
    }
    with tempfile.TemporaryDirectory() as folder, patch.object(
        rag, "get_embeddings", return_value=counted
    ):
        paths = [Path(folder) / name for name in ["first.pdf", "renamed.pdf"]]
        for path in paths:
            path.write_bytes(pdf)

        # This is the three-line uncached create_pdf_vectorstore implementation on parent main.
        def uncached(path):
            chunks = rag.load_pdf_chunks(path, chunk_size=1000, chunk_overlap=150)
            return InMemoryVectorStore.from_documents(chunks, embedding=counted)

        for name, build in [("before", uncached), ("after", rag.create_pdf_vectorstore)]:
            rag._pdf_cache.clear()
            counted.document_calls = 0
            timings = []
            for path in paths:
                start = perf_counter()
                store = build(str(path))
                timings.append(round((perf_counter() - start) * 1000, 3))
                assert all(r["metadata"]["source"] == str(path) for r in store.store.values())
            report[name] = {
                "milliseconds": timings, "documentEmbeddingCalls": counted.document_calls
            }
            report["chunks"] = len(store.store)
    assert report["before"]["documentEmbeddingCalls"] == 2
    assert report["after"]["documentEmbeddingCalls"] == 1
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
