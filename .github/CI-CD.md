# CI/CD Guide

How automated checks and deployment work for this project.

**Contributing?** You only need the [CI](#ci-what-runs-on-your-pr) section —
it explains what runs on your pull request and how to reproduce any failure
locally. The deployment section is for maintainers with production access.

---

## CI (what runs on your PR)

Every pull request runs [`ci.yml`](workflows/ci.yml). Jobs run in parallel,
so you get all the failures at once instead of one at a time.

| Job | What it checks |
|---|---|
| **Lint & type-check** | ESLint and TypeScript across every workspace, then a full build |
| **Prisma schema** | Migrations apply cleanly to a fresh database, and `schema.prisma` matches them |
| **Python checks** | The GenAI service compiles, and `ruff` passes |
| **Build images** | All four Dockerfiles still build |
| **Validate compose** | Both `docker-compose` files are well-formed |
| **Secret scan** | No credentials committed anywhere in history |
| **Dependency audit (report only)** | High-severity npm advisories in the committed pnpm workspace lockfile |

### Source and dependency scanning

[`codeql.yml`](workflows/codeql.yml) analyzes JavaScript/TypeScript, Python and
GitHub Actions on pull requests to `main`, pushes to `main` and every Tuesday.
It can also be started manually from the Actions tab. These languages use
CodeQL's `none` build mode, so analysis does not install dependencies, execute
package scripts or require application credentials. Only the analysis job has
`security-events: write`; it uploads results to **Security → Code scanning**.

The dependency-audit job runs `pnpm audit --audit-level=high` directly against
the committed lockfile, without installing packages. It deliberately reports
findings without blocking CI while the initial baseline is triaged. A green CI
run therefore does **not** mean the dependency audit found no advisories; read
that step's output. Keep the existing build, test and secret-scan gates intact.

[`dependabot.yml`](dependabot.yml) checks the root npm/pnpm workspace and
`apps/genAI` pip requirements weekly. Development-only npm version updates are
grouped to reduce noise. Version-update PR limits do not disable security
updates. Alerts and security-update settings are controlled by the repository
owner, not by this file. The current Python requirements are unpinned: this
configuration is not proof of a fully resolved Python dependency baseline or
that a future pip security-update PR has opened.

For the first scans, distinguish genuine findings from false positives and
record affected direct/transitive dependencies and available fixes. Do not add
blanket ignores or claim a clean baseline from a successful workflow alone.
Report exploitable source vulnerabilities privately using [SECURITY.md](../SECURITY.md),
and coordinate fixes with other assigned work before changing shared files.
Public third-party advisories can be tracked in a normal follow-up; make the
audit a gate only after the maintainer agrees how to handle the baseline.
The [initial dependency triage](security-baseline.md) records the measured
baseline, existing bot fixes and remaining remediation decisions.

### Reproducing a failure locally

Run the same commands CI does, from the repo root:

```bash
# Lint & type-check
pnpm run lint
pnpm run check-types
pnpm run build

# Python checks (needs apps/genAI/.venv, see below)
cd apps/genAI
python -m compileall -q app
pip install ruff && ruff check app

# Docker build (one service)
docker build -f apps/frontend/Dockerfile.prod .

# Compose validation
docker compose -f docker-compose.yml config --quiet
```

For Prisma, CI applies migrations to a throwaway database. To do the same
against your local one:

```bash
cd packages/db
pnpm exec prisma validate
pnpm exec prisma migrate deploy
```

If you changed `schema.prisma`, you must also commit a migration. CI fails
otherwise:

```bash
cd packages/db
pnpm exec prisma migrate dev --name describe_your_change
```

### Working on the GenAI service

The Python service is not covered by `pnpm install`. Set it up once:

```bash
cd apps/genAI
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env      # then add your own API keys
```

It needs free API keys from [Groq](https://console.groq.com/keys),
[Google AI Studio](https://aistudio.google.com/apikey), and
[Tavily](https://tavily.com). Without them the service still starts and
`/health` works — only the AI endpoints return an error telling you which key
is missing.

### Things to know

-**ESLint currently reports pre-existing errors** in the frontend. That step
  is set to report without blocking, so it will not fail your PR. Please do not
  add new ones — and a PR that cleans them up is welcome.
-**Ruff is enforced** for Python. Most issues auto-fix with
  `ruff check app --fix`.
-**Docker builds are cached**, but a cold run takes a while. The GenAI image
  is the slowest because of its ML dependencies.

---

## Deployment (maintainers)

>This section needs Docker Hub and production server access. Contributors can
>skip it — deploys happen automatically after a PR is merged.

Pushing to `main` triggers [`cd.yml`](workflows/cd.yml), which builds and
pushes four images to Docker Hub, scans them with Trivy, then deploys over SSH.

### Required secrets

Configured under **Settings → Secrets and variables → Actions**.

Repository secrets:

| Secret | Purpose |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub account owning the images |
| `DOCKERHUB_TOKEN` | Docker Hub access token, not a password |
| `DATABASE_URL` | Build arg so `prisma generate` can run during the image build |

Environment secrets, on an environment named `production`:

| Secret | Purpose |
|---|---|
| `SSH_HOST` | Server hostname or IP |
| `SSH_USER` | User permitted to run `docker` |
| `SSH_PRIVATE_KEY` | Private key, full PEM including BEGIN/END lines |
| `SSH_PORT` | Optional, defaults to `22` |
| `DEPLOY_PATH` | Absolute path to the repo checkout on the server |

Keeping deploy credentials on the environment rather than the repository limits
them to the `deploy` job, and lets you require a reviewer before anything
reaches production (**Environments → production → Required reviewers**).

### Server prerequisites

The pipeline does not bootstrap the server. Before the first deploy:

1. Docker and the Compose plugin installed.
2. Repository cloned at `DEPLOY_PATH`.
3. `.env.prod` present there with production values: `POSTGRES_USER`,
   `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `REDIS_PASSWORD`,
   `JWT_SECRET`, `FRONTEND_URL`, the GenAI keys, and `ALLOWED_ORIGINS`.
4. The public key matching `SSH_PRIVATE_KEY` in `~/.ssh/authorized_keys`.

`.env.prod` is never committed and never written by the pipeline. It lives only
on the server.

### Image tags and rollback

Every build publishes `:latest` and `:<commit-sha>`. The deploy pins the SHA, so
the running version is always unambiguous — and rolling back is one command:

```bash
cd <DEPLOY_PATH>
IMAGE_TAG=<last-good-sha> docker compose -f docker-compose.prod.yml up -d
```

### Database migrations

Migrations are **not** run by the deploy job. The `backend` service applies them
itself on startup, via its compose command. CI proves on every PR that the
migration history still applies to a clean database, so a broken migration is
caught before it reaches the server.

### Known gaps

-Trivy scanning is report-only; findings appear in logs but do not block a
  deploy.
-No staging environment — `main` goes straight to production.
-`docker compose up -d` recreates changed containers, so deploys have brief
  downtime. There is no rolling update.
