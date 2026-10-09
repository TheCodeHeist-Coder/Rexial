# Rexial super-admin

Two small apps that give one super-admin a view of the whole platform:

| App | What it is | Deploy to |
|---|---|---|
| `apps/admin-server` | Express API, reads the same Postgres database as http-server | Render (web service) |
| `apps/admin` | React panel that talks to that API | Vercel (or Render static site) |

Neither is built into a Docker image or run by CI/CD. Both are excluded on
purpose (`.dockerignore`, and the build step in `.github/workflows/ci.yml`).

## What the panel shows

- **Overview**: users (total, new, active), quizzes by status, sessions by
  outcome (completed, live, abandoned, cancelled), participants (guests vs
  signed-in), answer accuracy, average players and length per session,
  day-by-day charts for signups, players, sessions and API requests, live
  sessions right now, most-played quizzes and newest users. Refreshes every 30s.
- **Sessions**: every hosted session with host, player count, progress and
  duration; filter by live / completed / abandoned / cancelled. Per session:
  full leaderboard (with account email where the player was signed in) and
  per-question correct rate and answer time.
- **Quizzes**: every quiz with creator, questions, sessions and total
  participants. Per quiz: organizers, all sessions, question stats.
- **Users**: name, email, sign-up date, last login, last activity, quizzes
  created and played, total score. Search, sort, CSV export. Per user:
  everything they created and played, IPs/devices used, recent API calls.
- **API traffic**: requests, unique IPs, signed-in callers, 4xx/5xx rates,
  avg and p95 latency, per-endpoint table, status codes, browsers and
  platforms, busiest IPs and the latest failed requests.

### Abandoned and cancelled sessions

Rexial had no "cancelled" state: a session the host walks away from just
stays WAITING or IN_PROGRESS forever. The panel calls such a session
**abandoned** once it has been idle for `STALE_SESSION_HOURS` (default 3), and
offers a **Cancel** button that marks it `CANCELLED`, clears the quiz's join
code and puts the quiz back to draft so the host can relaunch it. Sessions that
are still live cannot be cancelled, because ws-server is still driving them.

### Where traffic data comes from

http-server logs every request (method, route, status, latency, IP, user id,
user agent) into the `ApiRequestLog` table. Rows are buffered in memory and
written in batches every 5 seconds, so requests don't wait on the database.
Rows older than `REQUEST_LOG_RETENTION_DAYS` (default 30, set on
**http-server**) are deleted hourly. Login also records `User.lastLoginAt`.

## Database migration

The panel needs migration `20260929100000_admin_panel_tracking` (the
`ApiRequestLog` table, `User.lastLoginAt` and the `CANCELLED` session status).
The production backend container applies pending migrations on start, so the
next normal deploy of http-server takes care of it. Deploy that first.

## Run locally

```bash
cp apps/admin-server/.env.example apps/admin-server/.env   # fill it in
cp apps/admin/.env.example apps/admin/.env.local
pnpm install
pnpm --filter @repo/db run db:generate
pnpm --filter admin-server dev     # http://localhost:5000
pnpm --filter admin dev            # http://localhost:5174
```

## Deploy the API to Render

New **Web Service** from this repo, root directory left empty (repo root):

| Setting | Value |
|---|---|
| Build command | `npm i -g pnpm@9.0.0 && pnpm install --frozen-lockfile --filter 'admin-server...' && pnpm --filter @repo/db run db:generate && pnpm --filter admin-server build` |
| Start command | `pnpm --filter admin-server start` |
| Health check path | `/health` |

The `--filter` installs only this app and the database package, not the
whole monorepo. Environment variables (see `.env.example`):

| Name | Notes |
|---|---|
| `NODE_VERSION` | `22` (the API needs Node 22.12 or newer). |
| `DATABASE_URL` | The production database. It must be reachable from Render, so the Postgres port on your server has to accept Render's connections (ideally over SSL and limited to Render's outbound IPs). |
| `ADMIN_EMAIL` | Your login email. |
| `ADMIN_PASSWORD` | 12+ characters; use a long random one. |
| `ADMIN_JWT_SECRET` | 32+ characters, e.g. `openssl rand -hex 32`. Must differ from http-server's `JWT_SECRET`. |
| `ADMIN_ORIGIN` | Required. The panel's URL, e.g. `https://rexial-admin.vercel.app`. Comma-separate several. |
| `STALE_SESSION_HOURS` | Optional, default 3. |

The server refuses to start if any required value is missing or too weak.

## Deploy the panel to Vercel

New project from this repo:

| Setting | Value |
|---|---|
| Root directory | `apps/admin` |
| Framework preset | Vite |
| Install command | `cd ../.. && pnpm install --frozen-lockfile --filter 'admin...'` |
| Build command | `pnpm run build` |
| Output directory | `dist` |
| Env var | `VITE_ADMIN_API_URL=https://<your-render-service>.onrender.com/api/admin` |

`vercel.json` already rewrites every path to `index.html` for client-side
routing. On a Render static site instead, add a rewrite rule `/*` → `/index.html`.

## Security notes

- There is exactly one admin account, defined by environment variables; it is
  not a row in the `User` table, so no app user can be promoted into it.
- Admin tokens are signed with their own secret and audience and expire after
  12 hours. Five wrong passwords from one IP lock logins for 15 minutes.
- The panel never receives password hashes, and the CSV export escapes cells
  that a spreadsheet would run as formulas.
- The panel page is marked `noindex`. Keep its URL private all the same.
