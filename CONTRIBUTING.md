# First Contribution Guide (For Beginners step-by-step guide)

Welcome! This guide will help you make your first contribution to the project.

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
DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb
```

*and in `/apps/http-server` put it :-

```bash
PORT=4000

JWT_SECRET=<yourJWTSecret>

DATABASE_URL=postgresql://postgres:postgres@db:5432/Qtrive

FRONTEND_URL=http://localhost:5173

```

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
docker-compose up --build
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
docker-compose up
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



## 15. Sync with Upstream (Important)
*Before new work, sync your fork
```bash
git checkout main
git pull upstream main
git push origin main
```


# NOW ALL SET, CONGRATULATION: YOU JUST HIT YOUR FIRST PR