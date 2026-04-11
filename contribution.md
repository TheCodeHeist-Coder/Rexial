# 🤝 First Contribution Guide (For Beginners step-by-step guide)

Welcome! This guide will help you make your first contribution to the project.

---

## 🚀 1. Fork the Repository

- Go to the project repository on GitHub
- Click the **Fork** button (top right)
- This creates your own copy of the repo

---

## 📥 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

## 🔗 3. Add Upstream Remote
* This lets you sync with the original repository:-
```bash
git remote add upstream https://github.com/<original-owner>/<repo-name>.git
git remote -v
```

## 📦 4. Install Dependencies
```bash
pnpm install
```

## ⚙️ 5. Setup Environment
* Create a `.env` file in the `/packages/db` & `/apps/http-server`:

* In `/packages/db` put it: -
```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb
```

* and in `/apps/http-server` put it :- 

```bash
PORT=4000

JWT_SECRET=<yourJWTSecret>

DATABASE_URL=postgresql://postgres:postgres@db:5432/Qtrive

FRONTEND_URL=http://localhost:5173

```

## 🐳 6. Start the Project
```bash
docker-compose up --build
```

## 🌱 7. Create a New Branch
* Always create a new branch for your work:
```bash
git checkout -b feature/<your-feature-name>
```
#### Examples:
* `feature/add-auth`
* `fix/ws-connection-bug`

## ✍️ 8. Make Your Changes
* Follow project structure:

* apps/ → services (http-server, ws-server, frontend)
* packages/db → Prisma + database

* Keep changes small and focused
* Follow existing code style


## 🧪 9. Test Your Changes
* Make sure everything works:
```bash
pnpm run dev
```

#### or with Docker

```bash
docker-compose up
```

## 💾 10. Commit Changes
* Write clear commit message
```bash
git add .
git commit -m "feat: add user authentication"
```

##### Common prefixes:

* feat: new feature
* fix: bug fix
* docs: documentation
* refactor: code improvement


## ⬆️ 11. Push to Your Fork
```bash
git push origin feature/<your-feature-name>
```

## 🔁 12. Create Pull Request (PR)
* Go to your fork on GitHub
* Click Compare & Pull Request
* Add:
   * Clear title
   * Description of changes
   * Screenshots (if UI changes)



## 🔄 13. Sync with Upstream (Important)
* Before new work, sync your fork
```bash
git checkout main
git pull upstream main
git push origin main
```


# NOW ALL SET, CONGRATULATION: YOU JUST HIT YOUR FIRST PR