# Project Setup Guide (Turborepo + Pnpm + Docker):

### Project Folder Structure
```
├── apps/
│   ├── http-server/
│   ├── ws-server/
│   ├── genAI/     # FastAPI GenAI service (Python)
│   └── frontend/
│
├── packages/
│   └── db/   # Prisma + PostgreSQL setup
│
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Prerequisites

#### Make sure you have the following installes:-

    *Node.js (>= 20)
    *pnpm (>= 9)
    *Python (>= 3.11)   # for the genAI service
    *Docker
    *Docker Compose

#### (1) Now, fork & clone the repository
```bash
git clone https://github.com/TheCodeHeist-Coder/Rexial.git
cd Rexial
```

#### (2) Install pnpm globally if not installed

```bash
npm install -g pnpm
```

#### (3) Install dependencies
```bash
pnpm install
```

#### (4) Setup Environment Variables

*Create a `.env` in `/packages/db` and put this ennvironment variable

```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb
```

*Create a `.env` file in `/apps/http-server` and put these variables
```bash
PORT=4000

JWT_SECRET=<yourJWTSecret>

DATABASE_URL=postgresql://postgres:postgres@db:5432/Qtrive

FRONTEND_URL=http://localhost:5173

```

*Create a `.env` file in `/apps/genAI` (copy from `.env.example`)
```bash
cp apps/genAI/.env.example apps/genAI/.env
```
Then fill in your keys:
```bash
GROQ_API_KEY=<yourGroqKey>
GOOGLE_API_KEY=<yourGoogleKey>
TAVILY_API_KEY=<yourTavilyKey>
```

#### (5) Start services with Docker
```bash
docker-compose up --build
```
*Build all services (http-server, ws-server, frontend, genAI)
*Start PostgreSQL database
*Start all containers


#### (6) Access the application
```
Frontend → http://localhost:5173
HTTP Server → http://localhost:4000
WebSocket Server → ws://localhost:8080
GenAI Service → http://localhost:8000  (docs at /docs)
PostgreSQL → localhost:5432
```

---

### Running the GenAI service without Docker

The Python service is part of the Turborepo workspace, so `pnpm dev` at the
repo root starts it alongside the JS apps — but it needs a virtualenv first:

```bash
cd apps/genAI
pnpm run setup      # creates .venv and installs requirements.txt
```

After that, from the repo root:

```bash
pnpm dev            # runs frontend, http-server, ws-server and genAI
```

Or run just the AI service:

```bash
pnpm --filter genai dev
```

#### Endpoints

| Method | Path                  | Description                             |
| ------ | --------------------- | --------------------------------------- |
| GET    | `/health`             | Health check (used by Docker)           |
| POST   | `/chat`               | Chat agent, with web search when needed |
| POST   | `/generate-questions` | Generate quiz questions from a PDF      |
| POST   | `/ask-pdf`            | Ask a question about an uploaded PDF    |
