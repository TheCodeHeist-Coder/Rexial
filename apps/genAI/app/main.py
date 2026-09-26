import json
import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.agent.Qnagent import chat
from app.rag.rag_system import PdfHasNoText, ask_pdf, generate_questions, generate_quiz
from app.utils.config import MissingAPIKey
from app.utils.errors import provider_http_error

app = FastAPI(title="Rexial GenAI Service")

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(MissingAPIKey)
async def missing_api_key_handler(request: Request, exc: MissingAPIKey):
    """Return a clear 503 instead of an opaque 500 when a key is absent."""

    return JSONResponse(
        status_code=503,
        content={"detail": str(exc)},
    )


@app.exception_handler(PdfHasNoText)
async def pdf_has_no_text_handler(request: Request, exc: PdfHasNoText):
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc)},
    )


UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Large PDFs blow past the model's context window and the client's
# timeout anyway, so reject them up front with a clear message.
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

MAX_QUIZ_QUESTIONS = 20

class ChatRequest(BaseModel):
    user_query: str


@contextmanager
def saved_upload(file: UploadFile) -> Iterator[Path]:
    """Write an uploaded PDF under UPLOAD_DIR for the duration of a request.

    Each upload gets a unique name so concurrent requests with the same
    filename cannot overwrite each other, and the file is deleted
    afterwards so the uploads volume does not grow without bound.
    """

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )

    file_path = UPLOAD_DIR / f"{uuid.uuid4().hex}.pdf"

    try:
        written = 0

        with open(file_path, "wb") as buffer:
            # copy in chunks so an oversized upload is rejected without
            # ever being written to disk in full
            while chunk := file.file.read(1024 * 1024):
                written += len(chunk)

                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"PDF is too large. The limit is {MAX_UPLOAD_MB} MB."
                    )

                buffer.write(chunk)

        yield file_path
    finally:
        file_path.unlink(missing_ok=True)


@app.get("/")
def home():
    return {"message": "AI Backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    try:
        response = chat(request.user_query)
    except MissingAPIKey:
        raise
    except Exception as exc:
        raise provider_http_error(exc) from exc

    return {
        "response": response
    }


@app.post("/generate-questions")
async def generate_pdf_questions(
    file: UploadFile = File(...),
    user_query: str = Form(...)
):

    with saved_upload(file) as file_path:
        try:
            questions = generate_questions(
                str(file_path),
                user_query
            )
        except (MissingAPIKey, PdfHasNoText):
            raise
        except Exception as exc:
            raise provider_http_error(exc) from exc

    return {
        "message": "Questions generated successfully",
        "filename": file.filename,
        "questions": questions
    }



@app.post("/ask-pdf")
async def ask_pdf_question(
    file: UploadFile = File(...),
    user_query: str = Form(...)
):

    with saved_upload(file) as file_path:
        try:
            answer = ask_pdf(
                str(file_path),
                user_query
            )
        except (MissingAPIKey, PdfHasNoText):
            raise
        except Exception as exc:
            raise provider_http_error(exc) from exc

    return {
        "message": "Answer generated successfully",
        "filename": file.filename,
        "question": user_query,
        "answer": answer
    }

def parse_exclude(raw: str) -> list[str]:
    """Decode the JSON list of question texts the model must not repeat."""

    if not raw:
        return []

    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="exclude must be a JSON list of strings."
        ) from exc

    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise HTTPException(
            status_code=400,
            detail="exclude must be a JSON list of strings."
        )

    return value


@app.post("/generate-quiz")
async def generate_quiz_endpoint(
    file: UploadFile = File(...),
    user_query: str = Form(""),
    count: int = Form(5, ge=1, le=MAX_QUIZ_QUESTIONS),
    difficulty: str = Form("Mixed"),
    exclude: str = Form(""),
):
    """Generate multiple-choice questions as structured JSON.

    Unlike /generate-questions, which returns a formatted text blob for
    humans to read, this returns data the quiz builder can render and
    save directly.

    `user_query` is an optional focus (topic, chapter); `exclude` is a JSON
    list of question texts not to repeat, used to regenerate one question.
    """

    excluded = parse_exclude(exclude)

    with saved_upload(file) as file_path:
        try:
            questions = generate_quiz(
                str(file_path),
                user_query,
                count=count,
                difficulty=difficulty,
                exclude=excluded,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"The model returned an unusable response: {exc}"
            ) from exc
        except (MissingAPIKey, PdfHasNoText):
            raise
        except Exception as exc:
            raise provider_http_error(exc) from exc

    if not questions:
        raise HTTPException(
            status_code=422,
            detail="No valid questions could be generated from this PDF. "
                   "Try a clearer request or a different document."
        )

    return {
        "message": "Quiz generated successfully",
        "filename": file.filename,
        "count": len(questions),
        "questions": questions,
    }
