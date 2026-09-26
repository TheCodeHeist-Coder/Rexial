# Rexial Architecture

An in-depth look at how Rexial is put together: the services, how they talk to
each other, and why the boundaries fall where they do.

New here? Read [contribution.md](contribution.md) first to get the project
running, then come back for the *why*.

---

## Contents

-[The short version](#the-short-version)
-[System overview](#system-overview)
-[Why a monorepo](#why-a-monorepo)
-[The services](#the-services)
-[Data model](#data-model)
-[Flow 1: Creating a quiz](#flow-1-creating-a-quiz)
-[Flow 2: AI question generation](#flow-2-ai-question-generation)
-[Flow 3: Running a live quiz](#flow-3-running-a-live-quiz)
-[Caching and scale](#caching-and-scale)
-[Deployment topology](#deployment-topology)
-[Design decisions](#design-decisions)
-[Known limitations](#known-limitations)

---

## The short version

Rexial is a live quiz platform. A host builds a quiz, generates a join code,
and starts a session; participants join with that code and answer questions in
real time, scored on speed, with a live leaderboard.

It is split into **four services** in one monorepo:

| Service | Stack | Port | Responsibility |
|---|---|---|---|
| `frontend` | React + Vite + Tailwind | 5173 | All UI |
| `http-server` | Express + Prisma | 4000 | Auth, CRUD, session setup |
| `ws-server` | `ws` + Redis | 8080 | Live gameplay, timers, scoring |
| `genAI` | FastAPI + LangChain | 8000 | AI question generation from PDFs |

Backed by **PostgreSQL** (source of truth) and **Redis** (hot cache + pub/sub).

---

## System overview

```
                          ┌──────────────────────────┐
                          │        Browser           │
                          │   React SPA (frontend)   │
                          └────┬──────────┬──────┬───┘
                               │          │      │
              REST (axios)     │    WS    │      │  multipart
              JWT in header    │  (live)  │      │  (PDF upload)
                               │          │      │
               ┌───────────────▼──┐  ┌────▼──────▼────┐  ┌──────────────┐
               │  http-server     │  │   ws-server    │  │    genAI     │
               │  Express :4000   │  │  ws :8080      │  │ FastAPI :8000│
               │                  │  │                │  │              │
               │ • auth (JWT)     │  │ • live session │  │ • PDF -> quiz│
               │ • quiz CRUD      │  │ • timers       │  │ • RAG Q&A    │
               │ • invites/email  │  │ • scoring      │  │   over PDFs  │
               │ • start session  │  │ • leaderboard  │  │ • chat       │
               └────────┬─────────┘  └───┬────────┬───┘  └──────┬───────┘
                        │                │        │             │
                        │  Prisma        │        │ cache       │ HTTPS
                        │                │        │ pub/sub     │
                   ┌────▼────────────────▼──┐  ┌──▼──────────┐  │
                   │      PostgreSQL        │  │    Redis    │  │
                   │   (source of truth)    │  │ (hot state) │  │
                   └────────────────────────┘  └─────────────┘  │
                                                                │
                                                     ┌──────────▼─────────┐
                                                     │  External LLM APIs │
                                                     │  Groq · Gemini ·   │
                                                     │  Tavily            │
                                                     └────────────────────┘
```

**The key split:** `http-server` owns everything *before* and *after* a quiz
runs. `ws-server` owns the quiz *while* it is running. They share a database
but never call each other — the handoff happens through the `QuizSession` row.

---

## Why a monorepo

Turborepo with pnpm workspaces:

```
Rexial/
├── apps/
│   ├── frontend/      React SPA
│   ├── http-server/   Express REST API
│   ├── ws-server/     WebSocket server
│   └── genAI/         Python FastAPI service
├── packages/
│   ├── db/            Prisma schema + generated client  (@repo/db)
│   ├── ui/            Shared components (scaffolded, not yet used)
│   ├── eslint-config/
│   └── typescript-config/
└── docker-compose.yml
```

The reason is `packages/db`. Both Node servers need identical database types;
publishing that to a registry for two consumers would be pure overhead. As a
workspace package, `@repo/db` is imported directly and a schema change surfaces
as a type error in both servers immediately.

`genAI` is in the workspace too, but only as a thin shim — its `package.json`
scripts shell out to Python so `pnpm dev` can start all four services at once.
Its real dependencies live in `requirements.txt`.

---

## The services

### frontend — React SPA

Vite + React 19 + Tailwind 4, Zustand for auth state, React Router for routing.

Two API clients, deliberately separate:

| Client | Base URL | Timeout | Why |
|---|---|---|---|
| `api` | `VITE_API_URL` → :4000 | 10s | Normal CRUD; attaches JWT, logs out on 401 |
| `genaiApi` | `VITE_GENAI_URL` → :8000 | **120s** | LLM calls are slow; 10s would abort every request |

The WebSocket connection is opened directly by the `LiveQuiz` screen, not
through a client wrapper.

### http-server — Express REST API

Everything transactional. Routes under `/api/v1`:

```
/auth
  POST /register              bcrypt hash, returns JWT
  POST /login                 verify, returns JWT
  GET  /me                    [auth] current user
                              (Google OAuth via passport is also wired up)

/quizzes
  POST /                      [auth] create quiz
  GET  /                      [auth] list my quizzes
  GET  /:quizId               quiz + questions + answers
  POST /:quizId/generate-access-code    create the join code
  POST /:quizId/questions               add a question + its answers
  POST /:quizId/start-session [auth] create QuizSession -> returns sessionId

/quizzes (invites)
  POST /:quizId/invite        email a co-organizer
  POST /invite/accept/:token  [auth] accept

/sessions
  POST /join                  participant joins by code -> participantId
  GET  /:sessionId/leaderboard
```

Auth is a stateless JWT in the `Authorization` header. Participants are
deliberately **not** required to register — they get a `Participant` row tied to
a session, not a `User`.

### ws-server — live gameplay

A raw `ws` server. Every message is `{ type, payload }`.

**Client → server**

| Type | Sent by | Effect |
|---|---|---|
| `join` | both | Binds the socket to a session and role |
| `quiz:start` | organizer | Starts the quiz |
| `quiz:next-question` | organizer | Broadcasts the next question, starts its timer |
| `quiz:submit-answer` | participant | Scores the answer, updates the leaderboard |
| `quiz:end` | organizer | Ends the session |

**Server → client**

| Type | Meaning |
|---|---|
| `participants:sync` | Full participant list (sent on organizer join) |
| `participant:joined` | Someone new joined the lobby |
| `quiz:start` | Quiz has begun |
| `quiz:question` | The current question — **answers stripped of `isCorrect`** |
| `quiz:timer-tick` | Countdown, once per second |
| `quiz:question-results` | Correct answer revealed after time expires |
| `quiz:leaderboard` | Updated standings |
| `quiz:ended` | Final results |

Two security-relevant details:

1. **Questions are sanitized before broadcast.** The `quiz:question` payload
   maps answers down to `{ id, text }` only. The client literally cannot know
   which option is correct, so you cannot cheat by reading the socket.
2. **Scoring happens server-side.** The client sends `timeMs`; the server
   decides correctness and points.

Scoring rewards speed:

```js
points = isCorrect ? Math.max(10, 1000 - timeMs) : 0
```

A correct answer in 200ms scores 800; one at 3s floors at 10. Wrong answers
score nothing.

### genAI — AI question generation

FastAPI, isolated from the Node services so the Python AI dependency tree
(LangChain, ONNX Runtime) never touches them.

| Endpoint | Purpose |
|---|---|
| `POST /generate-quiz` | **Structured JSON** questions — what the UI uses |
| `POST /generate-questions` | Same, as a readable text blob |
| `POST /ask-pdf` | RAG question-answering over an uploaded PDF |
| `POST /chat` | General chat; routes to web search when needed |
| `GET /health` | Liveness, used by the container healthcheck |

Providers: **Groq** for question generation, **Gemini** for chat, **Tavily**
for web search, **fastembed** (`bge-small-en-v1.5` on ONNX Runtime, CPU only)
for embeddings.

All clients are built **lazily on first use**. Constructing them at import time
meant a missing API key crashed the whole service on startup — including
`/health`, which made the container fail its healthcheck and restart forever.

---

## Data model

```
User ──┬──< Quiz ──┬──< Question ──< Answer
       │           │
       │           └──< QuizSession ──┬──< Participant ──< ParticipantAnswer
       │                              │                          │
       └──< QuizOrganizer             └──────────────────────────┘
            (co-hosts, invite flow)
```

| Model | Notes |
|---|---|
| `User` | Registered accounts. Hosts and co-organizers. |
| `Quiz` | Owned by a user. Holds `joinCode` and `QuizStatus`. |
| `QuizOrganizer` | Co-host link with `OrganizerRole` + `InviteStatus`. |
| `Question` / `Answer` | `Answer.isCorrect` is **never** sent to participants. |
| `QuizSession` | One live run of a quiz. Tracks `currentQuestionIndex`, `SessionStatus`. |
| `Participant` | A player in one session. **Not** a `User` — no signup needed. |
| `ParticipantAnswer` | One submission: answer, `timeMs`, `isCorrect`, `points`. |

`Quiz` is the template; `QuizSession` is one run of it. The same quiz can be
hosted repeatedly, each run with its own participants and leaderboard.

---

## Flow 1: Creating a quiz

```
Host                 frontend          http-server          PostgreSQL
 │                      │                   │                   │
 │ create quiz          │                   │                   │
 ├─────────────────────►│ POST /quizzes     │                   │
 │                      ├──────────────────►│ create Quiz       │
 │                      │                   ├──────────────────►│
 │                      │◄──────────────────┤ quizId            │
 │                      │                   │                   │
 │ add question ×N      │                   │                   │
 ├─────────────────────►│ POST /:id/questions                   │
 │                      ├──────────────────►│ Question + Answers│
 │                      │                   ├──────────────────►│
 │                      │                   │                   │
 │ generate join code   │                   │                   │
 ├─────────────────────►│ POST /:id/generate-access-code        │
 │                      ├──────────────────►│ joinCode, ACTIVE  │
 │                      │◄──────────────────┤                   │
 │  "ABC123"            │                   │                   │
 │                      │                   │                   │
 │ host live            │                   │                   │
 ├─────────────────────►│ POST /:id/start-session               │
 │                      ├──────────────────►│ create QuizSession│
 │                      │◄──────────────────┤ sessionId         │
 │                      │                                       │
 │                      └──► navigate to /quiz/manage/:sessionId
 │                           (from here, ws-server takes over)
```

---

## Flow 2: AI question generation

```
Host            frontend           genAI                Groq
 │                 │                  │                   │
 │ upload PDF      │                  │                   │
 │ + "5 questions  │                  │                   │
 │   on chapter 2" │                  │                   │
 ├────────────────►│                  │                   │
 │                 │ POST /generate-quiz (multipart)      │
 │                 ├─────────────────►│                   │
 │                 │                  │ save_upload()     │
 │                 │                  │ ↳ sanitize name   │
 │                 │                  │                   │
 │                 │                  │ PyPDFLoader       │
 │                 │                  │ ↳ chunk 3000/300  │
 │                 │                  │ ↳ whole PDF as    │
 │                 │                  │   context (no     │
 │                 │                  │   retrieval here) │
 │                 │                  │                   │
 │                 │                  │ prompt + context  │
 │                 │                  ├──────────────────►│
 │                 │                  │◄──────────────────┤ JSON
 │                 │                  │                   │
 │                 │                  │ _extract_json()   │
 │                 │                  │ ↳ strip fences    │
 │                 │                  │ validate:         │
 │                 │                  │  • exactly 4 opts │
 │                 │                  │  • exactly 1 true │
 │                 │                  │  • drop the rest  │
 │                 │◄─────────────────┤ questions[]       │
 │                 │                  │                   │
 │◄────────────────┤ review panel     │                   │
 │                 │                  │                   │
 │ edit / deselect │                  │                   │
 │ then "Add to Quiz"                 │                   │
 ├────────────────►│                  │                   │
 │                 │ POST /quizzes/:id/questions  ×N      │
 │                 ├──────────────────────────────► http-server
```

**Generation does not use retrieval.** Worth being precise, because the service
is described as "RAG" overall: `/generate-quiz` chunks the PDF and passes the
**entire** text as context, since questions should cover the whole document.
Only `/ask-pdf` does true RAG — it embeds chunks into a vector store and
retrieves the top 5 matches for the question. So the embedding model is never
loaded during quiz generation.

Two more things worth noting.

**The model is not trusted.** Its output is parsed defensively (`_extract_json`
handles markdown fences and chatty preambles) and then validated. Any question
without exactly 4 options and exactly 1 correct answer is **discarded**. A
malformed question is dropped rather than shown to the host or saved.

**The human is the last gate.** Generated questions land in a review panel.
Nothing is written to the database until the host confirms.

---

## Flow 3: Running a live quiz

```
Organizer          ws-server          Redis        PostgreSQL      Participants
    │                  │                 │              │               │
    │ join (ORGANIZER) │                 │              │               │
    ├─────────────────►│ getCachedSession│              │               │
    │                  ├────────────────►│ miss         │               │
    │                  │                 ├─────────────►│               │
    │◄─────────────────┤ participants:sync              │               │
    │                  │                 │              │               │
    │                  │◄───────────────────────────────────────────────┤ join
    │◄─────────────────┤ participant:joined ────────────────────────────►│
    │                  │                 │              │               │
    │ quiz:start       │                 │              │               │
    ├─────────────────►│                 │              │               │
    │◄─────────────────┤ quiz:start ────────────────────────────────────►│
    │                  │                 │              │               │
    │ quiz:next-question                 │              │               │
    ├─────────────────►│ strip isCorrect │              │               │
    │◄─────────────────┤ quiz:question ─────────────────────────────────►│
    │                  │ startQuestionTimer             │               │
    │◄─────────────────┤ quiz:timer-tick (1/sec) ──────────────────────►│
    │                  │                 │              │               │
    │                  │◄───────────────────────────────────────────────┤ submit
    │                  │ score it        │              │               │  answer
    │                  │ points =        │              │               │
    │                  │  max(10,1000-ms)│              │               │
    │                  ├────────────────────────────────►│ ParticipantAnswer
    │                  ├────────────────►│ leaderboard  │               │
    │                  │                 │              │               │
    │                  │ timer expires   │              │               │
    │◄─────────────────┤ quiz:question-results ────────────────────────►│
    │◄─────────────────┤ quiz:leaderboard ─────────────────────────────►│
    │                  │                 │              │               │
    │ quiz:end         │                 │              │               │
    ├─────────────────►│ clearSessionCache              │               │
    │◄─────────────────┤ quiz:ended ───────────────────────────────────►│
```

The organizer drives the pace — questions advance on `quiz:next-question`, not
automatically. Timers live in `timeManager.ts`, keyed per session.

---

## Caching and scale

### Redis as a cache

Hot session state is cached so a 50-player session does not hammer Postgres on
every answer:

| Key | Holds |
|---|---|
| `quiz:session:${sessionId}` | Session + quiz metadata |
| `quiz:questions:${sessionId}` | Questions with answers |
| `quiz:participant:${participantId}` | Participant record |
| `quiz:leaderboard:${sessionId}` | Current standings |

Writes go to Postgres and invalidate the relevant key
(`invalidateParticipants`, `invalidateLeaderboard`). `clearSessionCache` wipes
everything when a session ends. Postgres stays the source of truth; Redis is
never authoritative.

### Redis pub/sub for horizontal scale

This is the part that makes `ws-server` scalable, and it is easy to miss.

A WebSocket connection is pinned to one process. With two `ws-server`
instances behind a load balancer, an organizer on instance A and a participant
on instance B would never see each other's events.

`broadcastToSession` solves it by doing two things at once:

```js
// 1. deliver to sockets on THIS instance
for (const client of clients) { ...client.ws.send(...) }

// 2. publish to every OTHER instance
pub.publish(sessionChannel(sessionId), envelope)
```

Each instance subscribes to `session:*` and relays what it receives to its own
clients. The envelope carries a `_sid` (a per-process UUID), and the subscriber
**drops messages it published itself** — otherwise local clients would receive
every event twice.

```
   instance A                  Redis                  instance B
  ┌──────────┐                                       ┌──────────┐
  │ organizer│──broadcast──┬──► local sockets        │          │
  └──────────┘             │                         │          │
                           └──► publish session:X ──►│ relay ──►│ participant
                                                     └──────────┘
                            (A ignores its own _sid)
```

So the WS tier can scale horizontally today. The compose file runs a single
instance, but nothing in the code assumes that.

---

## Deployment topology

```
                    Internet
                       │
                       ▼
          ┌────────────────────────┐
          │  nginx-proxy-manager   │  :80 :443 (TLS, routing)
          │                        │  :81      (admin UI)
          └──┬─────┬─────┬─────┬───┘
             │     │     │     │
    ┌────────▼┐ ┌──▼───┐ ┌▼─────┐ ┌▼──────┐
    │frontend │ │backend│ │ ws   │ │ genai │
    │ (nginx) │ │ :4000 │ │:8080 │ │ :8000 │
    └─────────┘ └───┬───┘ └──┬───┘ └───────┘
                    │        │
              ┌─────▼────┐ ┌─▼──────┐
              │ postgres │ │ redis  │
              │ (volume) │ │(volume)│
              └──────────┘ └────────┘

         all on the private `rexial-network` bridge
```

Only nginx is exposed. Everything else is reachable only inside the Docker
network.

> **Warning:** Port **81** is the nginx-proxy-manager admin UI. It is published on the
>host, so it should be firewalled to trusted IPs — anyone who reaches it can
>re-route your traffic.

Images are built by GitHub Actions and tagged `:latest` **and** `:<commit-sha>`;
the deploy pins the SHA so rollback is exact. See
[.github/CI-CD.md](.github/CI-CD.md).

Migrations are applied by the `backend` container on startup, not by the deploy
job:

```
db:generate:prod && db:migrate && start
```

---

## Design decisions

**Why split HTTP and WebSocket servers?**
Different scaling shapes. REST traffic is bursty and stateless; WS connections
are long-lived and stateful. Splitting lets you run many WS instances during a
big quiz without over-provisioning the REST tier.

**Why is the AI service Python and separate?**
The libraries that matter (LangChain, fastembed) are Python-only.
Isolating them keeps the ML dependency tree out of the Node images, lets the
service scale independently, and means an LLM outage degrades one feature rather
than taking down the platform.

**Why do participants not need accounts?**
Signup is the biggest drop-off in a classroom or event. A `Participant` row
belongs to a session, not a user. Registering later is optional and only needed
to see past history.

**Why cache in Redis instead of in process memory?**
In-process cache breaks the moment you run two instances — and the same Redis
is already needed for pub/sub.

**Why is scoring server-side?**
It is the only place it can be trusted. The client never learns which answer is
correct until results are revealed.

---

## Known limitations

Honest list of what is not solved yet.

| Area | Limitation |
|---|---|
| **Join codes** | Generation has a race condition — two concurrent requests can collide (tracked in [issues.md](issues.md) #1) |
| **AI vector store** | `InMemoryVectorStore` is rebuilt per request; no caching, so the same PDF is re-embedded every time (#5) |
| **AI cost** | No rate limiting or per-user quota on generation endpoints |
| **Reconnection** | A participant who drops mid-quiz rejoins the lobby, but in-flight question state is not restored |
| **Deploys** | `docker compose up -d` recreates containers — brief downtime, no rolling update |
| **Environments** | No staging; `main` deploys straight to production |
| **Tests** | No automated test suite. CI covers lint, types, builds and migrations, but not behaviour |
| **Frontend lint** | ~20 pre-existing eslint errors; the CI lint step reports without blocking (#6) |
