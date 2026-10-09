# Rexial super-admin panel

React front end for [`apps/admin-server`](../admin-server/README.md). It shows
platform stats, every quiz, session and user, and API traffic. Setup and
deployment for both halves are documented in the admin-server README.

```bash
cp .env.example .env.local   # point VITE_ADMIN_API_URL at the admin API
pnpm --filter admin dev      # http://localhost:5174
```
