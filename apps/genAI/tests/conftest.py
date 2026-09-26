import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from langchain_core.embeddings import Embeddings

from app import main
from app.agent import Qnagent
from app.rag import rag_system


def make_pdf(*lines: str) -> bytes:
    """Build a minimal single-page PDF whose text layer holds `lines`.

    With no lines the page has no text at all, like a scanned document.
    """

    ops = ["BT", "/F1 12 Tf", "72 720 Td"]

    for line in lines:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        ops += [f"({escaped}) Tj", "0 -16 Td"]

    ops.append("ET")
    stream = "\n".join(ops).encode() if lines else b""

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
    ]

    out = b"%PDF-1.4\n"
    offsets = []

    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"

    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )

    return out


SAMPLE_PDF = make_pdf(
    "Photosynthesis converts light energy into chemical energy.",
    "Mitochondria are the powerhouse of the cell.",
)


def question(text: str, difficulty: str = "Medium", correct: int = 0) -> dict:
    return {
        "text": text,
        "difficulty": difficulty,
        "options": [
            {"text": f"{text} option {i}", "isCorrect": i == correct}
            for i in range(4)
        ],
    }


class FakeLLM:
    """Records every prompt and replies with queued responses in order."""

    def __init__(self):
        self.prompts = []
        self.replies = []

    def reply(self, *contents):
        self.replies.extend(contents)
        return self

    def invoke(self, prompt):
        self.prompts.append(prompt)

        content = self.replies.pop(0) if self.replies else "ok"

        if isinstance(content, Exception):
            raise content

        return SimpleNamespace(content=content)


class KeywordEmbeddings(Embeddings):
    """Deterministic embeddings: one dimension per keyword it contains."""

    KEYWORDS = ("photosynthesis", "light", "mitochondria", "cell", "energy")

    def _embed(self, text: str) -> list[float]:
        lowered = text.lower()
        return [1.0 if k in lowered else 0.0 for k in self.KEYWORDS] + [0.01]

    def embed_documents(self, texts):
        return [self._embed(t) for t in texts]

    def embed_query(self, text):
        return self._embed(text)


@pytest.fixture
def groq(monkeypatch):
    llm = FakeLLM()
    monkeypatch.setattr(rag_system, "get_groq_llm", lambda: llm)
    return llm


@pytest.fixture
def gemini(monkeypatch):
    llm = FakeLLM()
    monkeypatch.setattr(Qnagent, "get_google_llm", lambda: llm)
    return llm


@pytest.fixture
def fake_embeddings(monkeypatch):
    monkeypatch.setattr(rag_system, "get_embeddings", KeywordEmbeddings)


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "UPLOAD_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def client(upload_dir):
    return TestClient(main.app)


def quiz_reply(*questions: dict) -> str:
    return json.dumps({"questions": list(questions)})
