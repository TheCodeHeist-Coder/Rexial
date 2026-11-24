import hashlib
import io
import json
import re
from collections import OrderedDict
from concurrent.futures import Future
from copy import deepcopy
from pathlib import Path
from threading import Lock

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError

from app.prompts.quiz_json_prompt import QUIZ_JSON_PROMPT
from app.prompts.rag_Qna_generate_prompt import QUESTION_GENERATION_PROMPT
from app.utils.llm import get_groq_llm

# Small ONNX model run by fastembed. It avoids pulling in torch (and its
# multi-GB CUDA wheels) and needs a fraction of the RAM of a torch model.
# Vectors are never persisted, so changing the model needs no migration.
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"

DIFFICULTIES = ("Low", "Medium", "High")

_embeddings = None
_embeddings_lock = Lock()

PDF_CHUNK_SIZE = 1000
PDF_CHUNK_OVERLAP = 150
PDF_CACHE_MAX_ENTRIES = 4
PDF_CACHE_MAX_CHUNKS = 2000
_pdf_cache: OrderedDict[tuple, InMemoryVectorStore] = OrderedDict()
_pdf_inflight: dict[tuple, Future] = {}
_pdf_cache_lock = Lock()


class PdfProblem(Exception):
    """A problem with the uploaded PDF itself, not with the AI provider.

    `status_code` is the HTTP status main.py answers with.
    """

    status_code = 422


class PdfHasNoText(PdfProblem):
    """Raised when a PDF has no extractable text, e.g. a scanned document."""


class PdfEncrypted(PdfProblem):
    """Raised when a PDF is password protected and cannot be read."""


class PdfUnreadable(PdfProblem):
    """Raised when a file is corrupt, truncated or empty, so it cannot be parsed."""

    status_code = 400


class FastEmbedEmbeddings(Embeddings):
    """LangChain adapter over fastembed's ONNX text embedding model."""

    def __init__(self, model_name: str):
        from fastembed import TextEmbedding

        self._model = TextEmbedding(model_name=model_name)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self._model.embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        # query_embed applies the query instruction prefix bge expects
        return next(iter(self._model.query_embed(text))).tolist()


def get_embeddings():
    """Load the embedding model on first use.

    Loading at import time would block application startup (and the
    /health endpoint) while the model is fetched, which makes the
    container fail its healthcheck on a cold start.
    """

    global _embeddings

    with _embeddings_lock:
        if _embeddings is None:
            _embeddings = FastEmbedEmbeddings(EMBEDDING_MODEL)

    return _embeddings


def load_pdf_chunks(
    pdf_path: str, chunk_size: int, chunk_overlap: int, *, pdf_bytes: bytes | None = None
) -> list[Document]:
    """Read a PDF page by page and split it into overlapping chunks."""

    try:
        documents = [
            Document(
                page_content=page.extract_text() or "",
                metadata={"source": pdf_path, "page": number},
            )
            for number, page in enumerate(
                PdfReader(io.BytesIO(pdf_bytes) if pdf_bytes is not None else pdf_path).pages
            )
        ]
    except FileNotDecryptedError as exc:
        raise PdfEncrypted(
            "This PDF is password protected. Remove the password and "
            "upload it again."
        ) from exc
    except Exception as exc:
        # pypdf raises its own errors for bad files, but also the odd
        # KeyError or ValueError on a mangled one; none of them are the
        # provider's fault
        raise PdfUnreadable(
            "This PDF could not be read. It may be corrupt or not a real "
            "PDF. Try exporting it again."
        ) from exc

    if not any(doc.page_content.strip() for doc in documents):
        raise PdfHasNoText(
            "This PDF has no selectable text (it may be a scanned image). "
            "Try a PDF exported from a document instead."
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )

    return splitter.split_documents(documents)


def generate_questions(pdf_path: str, user_query: str):

    chunks = load_pdf_chunks(pdf_path, chunk_size=3000, chunk_overlap=300)

    context = "\n\n".join(
        doc.page_content
        for doc in chunks
    )

    prompt = QUESTION_GENERATION_PROMPT.format(
        context=context,
        user_query=user_query
    )

    response = get_groq_llm().invoke(prompt)

    return response.content


def create_pdf_vectorstore(pdf_path: str):
    """Reuse document vectors, with request-local source paths and mutable records."""

    try:
        pdf_bytes = Path(pdf_path).read_bytes()
    except OSError as exc:
        raise PdfUnreadable("This PDF could not be read. Try uploading it again.") from exc

    key = (
        hashlib.sha256(pdf_bytes).hexdigest(),
        EMBEDDING_MODEL,
        PDF_CHUNK_SIZE,
        PDF_CHUNK_OVERLAP,
    )
    with _pdf_cache_lock:
        cached = _pdf_cache.get(key)
        owner = False
        if cached is not None:
            _pdf_cache.move_to_end(key)
        else:
            future = _pdf_inflight.get(key)
            if future is None:
                future = _pdf_inflight[key] = Future()
                owner = True

    if cached is not None or not owner:
        del pdf_bytes

    if cached is None:
        if not owner:
            cached = future.result()
        else:
            try:
                # Hash and parse the same snapshot, even if the file is replaced meanwhile.
                chunks = load_pdf_chunks(
                    pdf_path, PDF_CHUNK_SIZE, PDF_CHUNK_OVERLAP, pdf_bytes=pdf_bytes
                )
                del pdf_bytes
                for chunk in chunks:
                    chunk.metadata.pop("source", None)
                cached = InMemoryVectorStore.from_documents(chunks, embedding=get_embeddings())
                with _pdf_cache_lock:
                    # Oversized stores serve this flight but do not evict useful cached PDFs.
                    if len(cached.store) <= PDF_CACHE_MAX_CHUNKS:
                        _pdf_cache[key] = cached
                        while (
                            len(_pdf_cache) > PDF_CACHE_MAX_ENTRIES
                            or sum(len(store.store) for store in _pdf_cache.values())
                            > PDF_CACHE_MAX_CHUNKS
                        ):
                            _pdf_cache.popitem(last=False)
                    _pdf_inflight.pop(key)
                future.set_result(cached)
            except BaseException as exc:
                with _pdf_cache_lock:
                    _pdf_inflight.pop(key, None)
                future.set_exception(exc)
                raise

    # Retrieval returns mutable metadata; never expose the shared cached records.
    view = InMemoryVectorStore(embedding=cached.embedding)
    view.store = deepcopy(cached.store)
    for record in view.store.values():
        record["metadata"]["source"] = pdf_path
    return view


def ask_pdf(pdf_path: str, user_query: str):

    vectorstore = create_pdf_vectorstore(pdf_path)

    docs = vectorstore.similarity_search(
        user_query,
        k=5
    )

    context = "\n\n".join(
        doc.page_content
        for doc in docs
    )

    prompt = f"""
You are a PDF question-answering assistant.

Answer the user's question using ONLY the information
provided in the PDF context.

If the answer is not available in the context,
say that the information is not available in the PDF.

PDF Context:
{context}

User Question:
{user_query}

Give a clear and accurate answer.
"""

    response = get_groq_llm().invoke(prompt)

    return response.content

def _extract_json(raw: str) -> dict:
    """Pull a JSON object out of an LLM response.

    Models often wrap JSON in markdown fences or add a sentence around it
    despite being told not to, so fall back to the outermost braces.
    """

    text = raw.strip()

    if text.startswith("```"):
        # drop the opening fence (which may be ```json) and closing fence
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model response did not contain a JSON object.")

    return json.loads(text[start:end + 1])


def build_quiz_prompt(
    context: str,
    user_query: str,
    count: int,
    difficulty: str,
    exclude: list[str],
) -> str:
    """Fill the quiz prompt from the structured generator settings."""

    if difficulty in DIFFICULTIES:
        difficulty_rule = f'Every question must have "difficulty": "{difficulty}".'
    else:
        difficulty_rule = "Mix Low, Medium and High difficulty."

    if exclude:
        listed = "\n".join(f"- {text}" for text in exclude)
        exclude_rule = (
            "Do NOT repeat or rephrase any of these existing questions:\n"
            f"{listed}"
        )
    else:
        exclude_rule = ""

    return QUIZ_JSON_PROMPT.format(
        context=context,
        user_query=user_query.strip() or "Cover the most important concepts.",
        count=count,
        difficulty_rule=difficulty_rule,
        exclude_rule=exclude_rule,
    )


def generate_quiz(
    pdf_path: str,
    user_query: str,
    count: int = 5,
    difficulty: str = "Mixed",
    exclude: list[str] | None = None,
) -> list[dict]:
    """Generate multiple-choice questions as structured data.

    Returns at most `count` questions, each with exactly four options and
    exactly one correct answer. Malformed questions are dropped rather
    than failing the whole request. `difficulty` is one of DIFFICULTIES,
    or anything else for a mix; `exclude` lists question texts the model
    must not repeat (used to regenerate a single question).
    """

    chunks = load_pdf_chunks(pdf_path, chunk_size=3000, chunk_overlap=300)

    context = "\n\n".join(doc.page_content for doc in chunks)

    prompt = build_quiz_prompt(context, user_query, count, difficulty, exclude or [])

    response = get_groq_llm().invoke(prompt)

    payload = _extract_json(str(response.content))

    if not isinstance(payload, dict) or not isinstance(payload.get("questions"), list):
        raise ValueError('Model response was not an object with a "questions" list.')

    questions = []

    for item in payload.get("questions", []):
        text = str(item.get("text", "")).strip()
        options = item.get("options", [])

        if not text or not isinstance(options, list):
            continue

        cleaned = [
            {
                "text": str(o.get("text", "")).strip(),
                "isCorrect": bool(o.get("isCorrect", False)),
            }
            for o in options
            if isinstance(o, dict) and str(o.get("text", "")).strip()
        ]

        # the UI and the quiz schema both assume four options with a
        # single correct answer, so discard anything else
        if len(cleaned) != 4:
            continue

        if sum(o["isCorrect"] for o in cleaned) != 1:
            continue

        difficulty = str(item.get("difficulty", "Medium")).capitalize()

        if difficulty not in DIFFICULTIES:
            difficulty = "Medium"

        questions.append({
            "text": text,
            "difficulty": difficulty,
            "options": cleaned,
        })

    return questions[:count]
