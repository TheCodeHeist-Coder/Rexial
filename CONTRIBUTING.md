# First Contribution Guide (For Beginners step-by-step guide)

Welcome! This guide will help you make your first contribution to the project.

Use Node.js 22 or newer and pnpm 9 or newer. Docker Compose provides the
PostgreSQL and Redis services used by the app; Redis carries live quiz messages
and caches quiz state.

---

## 0. Claim the issue first

**Before you write any code, get the issue assigned to you.** A pull request
for an issue nobody was assigned may be closed without review, however good
the code is.

This is not bureaucracy. It has already cost people real work here: two
contributors independently fixed the same issue, and one of them spent an
evening on a change that had merged the day before. That was our fault for
leaving the issue unassigned, and this rule is the fix.

### How to claim

1. Find an issue nobody is assigned to. [Good first issues](https://github.com/TheCodeHeist-Coder/Rexial/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
   are the place to start.
2. Comment on it saying you would like to take it. One line is enough.
3. **Wait for a maintainer to reply.** You are claimed once a maintainer
   assigns you *or* replies saying it is yours — GitHub will not let us assign
   people who are not yet collaborators, so the reply is what counts.
4. Then start work.

We usually answer within a day or two. If three days pass with no reply, say
so on the issue and tag `@TheCodeHeist-Coder` — a missed notification is far
more likely than a no.

### The 14-day rule

An issue assigned to you is held for **14 days**.

If there is no visible progress and no word from you in that time, we will
unassign you and reopen it to others. Visible progress means a draft PR, a
commit pushed to a branch, or simply a comment saying where you have got to.

**A comment is enough to keep it.** If you are busy, stuck, or something came
up, say so and we will extend it — nobody has ever been turned down for
asking. We only reclaim issues that have gone quiet, and we always comment
before doing so.

If you decide not to continue, please say so. It takes you ten seconds and
saves the next person two weeks.

### When you do not need to claim

- **Typos, broken links, formatting** — just open the PR.
- **A bug you found yourself that has no issue** — open an issue describing
  it, say you are working on it, and go ahead. You do not need to wait.
- **Security vulnerabilities** — do not open a public issue at all. See
  [SECURITY.md](SECURITY.md).

### Before you start, check

- Is anyone assigned? The sidebar shows it.
- Has someone already asked for it in the comments?
- Is there an open PR linked to it? Check the issue's timeline.

If any of those is true, pick another issue — or ask whether help is wanted.
Some larger issues split well between two people.

---

## 1. Fork the Repository

-Go to the project repository on GitHub
-Click the **Fork** button (top right)
-This creates your own copy of the repo

---

## 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/Rexial.git
cd Rexial
```

## 3. Add Upstream Remote
*This lets you sync with the original repository:-
```bash
git remote add upstream https://github.com/TheCodeHeist-Coder/Rexial.git
git remote -v
```

## 4. Install Dependencies
```bash
pnpm install
```

## 5. Setup Environment
*Create a `.env` file in the `/packages/db` & `/apps/http-server`:

*In `/packages/db` put it: -
```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/Qtrive
```

*and in `/apps/http-server` put it :-

```bash
PORT=4000

JWT_SECRET=<yourJWTSecret>

DATABASE_URL=postgresql://postgres:postgres@db:5432/Qtrive

FRONTEND_URL=http://localhost:5173

# Comma-separated origins the browser may call the API from.
# Optional, this is the default.
CORS_ORIGIN=http://localhost:5173

```

*When running `/apps/ws-server` outside Docker*, copy `.env.example` and put
the **same** `JWT_SECRET` as http-server. The ws-server uses it to check the
host's login before it lets a socket start, advance or end a quiz. If the two
values differ the host is refused with `ORGANIZER_AUTH_FAILED`:

```bash
cp apps/ws-server/.env.example apps/ws-server/.env
```

Docker Compose passes `apps/http-server/.env` to ws-server directly, so a
separate ws-server `.env` is not required when using `docker compose up`.

For a local `pnpm run dev` outside Compose, `redis` and `db` are not valid
hostnames. Start PostgreSQL 15 and Redis 7 locally (or run
`docker compose up -d db redis`), then change the database URLs to
`localhost:5432` in `packages/db/.env` and `apps/http-server/.env`. In
`apps/ws-server/.env`, set the same local `DATABASE_URL`, `REDIS_HOST=localhost`,
and `REDIS_PORT=6379`. If using Compose's Redis service, also set
`REDIS_PASSWORD=thisistheredisPassword`; leave it unset for a local Redis
installation with no password. See [setup.md](setup.md) for the full example.

*Working on **live video**? `/apps/streaming` needs the same `JWT_SECRET` too:

```bash
cp apps/streaming/.env.example apps/streaming/.env
docker compose --profile streaming up
```

and run the frontend with `VITE_STREAMING_URL=http://localhost:7000`. See
[apps/streaming/README.md](apps/streaming/README.md).

*The **GenAI service** (`/apps/genAI`) has its own env. Copy the example:

```bash
cp apps/genAI/.env.example apps/genAI/.env
```

*Then add your own free API keys — [Groq](https://console.groq.com/keys),
  [Google AI Studio](https://aistudio.google.com/apikey),
  [Tavily](https://tavily.com):

```bash
GROQ_API_KEY=<yourGroqKey>
GOOGLE_API_KEY=<yourGoogleKey>
TAVILY_API_KEY=<yourTavilyKey>
```

> **Note:** Without these keys the app still runs — only the AI features return an
>error saying which key is missing. You can skip them unless you are working
>on the GenAI service.

## 6. Start the Project
```bash
docker compose up --build
```

## 7. Create a New Branch
*Always create a new branch for your work:
```bash
git checkout -b feature/<your-feature-name>
```
#### Examples:
*`feature/add-auth`
*`fix/ws-connection-bug`

## 8. Make Your Changes
*Follow project structure:

*apps/ → services (http-server, ws-server, frontend, genAI)
*apps/genAI → Python / FastAPI service for AI quiz generation (RAG)
*packages/db → Prisma + database

*Keep changes small and focused
*Follow existing code style

> Unsure how the pieces fit together? [ARCHITECTURE.md](ARCHITECTURE.md)
>explains each service, the data model, and how a live quiz actually runs.


## 9. Working on the GenAI Service (optional)

*The AI service is **Python**, so `pnpm install` does not cover it
*If your change touches `/apps/genAI`, set up a virtual environment:

```bash
cd apps/genAI
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

*Run it on its own (Docker does this for you otherwise):

```bash
pnpm --filter genai dev     # starts on http://localhost:8000
```

*Interactive API docs are at http://localhost:8000/docs — handy for trying
  the endpoints without the frontend
*Python code is linted with **ruff**, and CI enforces it:

```bash
.venv/bin/ruff check app --fix
```

#### What the service does
*`POST /generate-quiz` → reads an uploaded PDF and returns multiple-choice
  questions as JSON (this is what the **Generate with AI** button uses)
*`POST /ask-pdf` → answers a question about an uploaded PDF
*`POST /chat` → general chat, searches the web when the question needs it


## 10. Test Your Changes
*Make sure everything works:
```bash
pnpm run dev
```

#### or with Docker

```bash
docker compose up
```

## 11. Commit Changes
*Write clear commit message
```bash
git add .
git commit -m "feat: add user authentication"
```

##### Common prefixes:

*feat: new feature
*fix: bug fix
*docs: documentation
*refactor: code improvement


## 12. Push to Your Fork
```bash
git push origin feature/<your-feature-name>
```

## 13. Automated Checks

*When you open a PR, GitHub Actions runs lint, type-checks, builds, and tests automatically
*If something fails, click **Details** on the failed check to see why
*See [.github/CI-CD.md](.github/CI-CD.md) for what each check does and how to reproduce it locally


## 14. Create Pull Request (PR)
*Go to your fork on GitHub
*Click Compare & Pull Request
*Add:
   *Clear title
   *Description of changes
   *Screenshots (if UI changes)
   *`Closes #<issue>` — the issue that was assigned to you in step 0

> Opening a PR for an issue that was never assigned to you? See
>[step 0](#0-claim-the-issue-first). Small doc and typo fixes are exempt;
>anything larger may be closed without review, so it is worth a quick check.



## 15. Sync with Upstream (Important)
*Before new work, sync your fork
```bash
git checkout main
git pull upstream main
git push origin main
```


# NOW ALL SET, CONGRATULATION: YOU JUST HIT YOUR FIRST PR
