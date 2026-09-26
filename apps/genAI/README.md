# GenAI Service

FastAPI service powering Rexial's AI features: PDF-grounded question
generation, PDF Q&A (RAG), and a chat agent with web search.

## Structure

```
apps/genAI/
├── app/
│   ├── main.py       # FastAPI app and routes
│   ├── agent/        # chat agent (router + Tavily web search)
│   ├── rag/          # PDF loading, chunking, embeddings, retrieval
│   ├── prompts/      # prompt templates
│   └── utils/        # config and LLM clients
├── tests/            # pytest suite (LLMs and embeddings are faked)
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile        # dev (hot reload)
└── Dockerfile.prod   # production (venv, baked model, non-root)
```

## Setup

```bash
cp .env.example .env    # then fill in your API keys
pnpm run setup          # creates .venv, installs requirements + test tools
pnpm run dev            # http://localhost:8000
pnpm run test           # runs the pytest suite, no API keys needed
```

Interactive API docs: http://localhost:8000/docs

## Environment

| Variable          | Description                                  |
| ----------------- | -------------------------------------------- |
| `GROQ_API_KEY`    | Groq key, used for RAG and question generation |
| `GOOGLE_API_KEY`  | Gemini key, used by the chat agent            |
| `TAVILY_API_KEY`  | Tavily key, used for web search               |
| `GENAI_PORT`      | Port to listen on (default `8000`)            |
| `UPLOAD_DIR`      | Where uploaded PDFs are held during a request |
| `MAX_UPLOAD_MB`   | Largest PDF accepted (default `10`)           |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins, or `*`          |

## Endpoints

| Method | Path                  | Body                        |
| ------ | --------------------- | --------------------------- |
| GET    | `/health`             | –                           |
| POST   | `/chat`               | JSON `{ user_query }`       |
| POST   | `/generate-questions` | multipart `file`, `user_query` |
| POST   | `/ask-pdf`            | multipart `file`, `user_query` |
| POST   | `/generate-quiz`      | multipart `file`, optional `user_query` (focus), `count` (1–20, default 5), `difficulty` (`Low`/`Medium`/`High`/`Mixed`), `exclude` (JSON list of question texts not to repeat) |

PDF endpoints return `413` for files over `MAX_UPLOAD_MB` and `422` for PDFs
with no selectable text (e.g. scanned images).

## Docker

Both compose files include this service (`genai`). Built from the repo root:

```bash
docker compose up --build genai
```

The production image bakes the `bge-small-en-v1.5` embedding model in at
build time, so containers don't download it on cold start. Embeddings run on
CPU through fastembed (ONNX Runtime) rather than torch, which keeps the image
under 1 GB and the running service around 300 MB of RAM.

## Deployment notes

In production the service runs on the `rexial-network` and is exposed through
nginx-proxy-manager, the same way `frontend` / `backend` / `ws-server` are.

Add a proxy host in nginx-proxy-manager (port `81`):

| Field           | Value          |
| --------------- | -------------- |
| Domain          | `ai.rexial.in` |
| Forward hostname | `genai`        |
| Forward port    | `8000`         |

Then set these in `.env.prod` on the server:

```bash
GROQ_API_KEY=...
GOOGLE_API_KEY=...
TAVILY_API_KEY=...
ALLOWED_ORIGINS=https://rexial.in
```

`ALLOWED_ORIGINS` should be the real frontend origin in production — the
`*` default is only for local development.

Note: PDF uploads are written to the `genai_uploads` volume under a unique
name only for the duration of a request, and deleted once it finishes.
