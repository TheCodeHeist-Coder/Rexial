# 💡 Project Setup Guide (Turborepo + Pnpm + Docker):

### 🗂️ Project Folder Structure
```
├── apps/
│   ├── http-server/
│   ├── ws-server/
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

### 🎟️ Prerequisites

#### Make sure you have the following installes:-
   
    * Node.js (>= 20)
    * pnpm (>= 9)
    * Docker
    * Docker Compose

#### (1) Now, fork & clone the repository
```bash
git clone https://github.com/TheCodeHeist-Coder/Qtrive.git
cd Qtrive
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

* Create a `.env` in `/packages/db` and put this ennvironment variable

```bash
DATABASE_URL=postgresql://postgres:postgres@db:5432/mydb
```

* Create a `.env` file in `/apps/http-server` and put these variables
```bash
PORT=4000

JWT_SECRET=<yourJWTSecret>

DATABASE_URL=postgresql://postgres:postgres@db:5432/Qtrive

FRONTEND_URL=http://localhost:5173

```

#### (5) Start services with Docker
```bash
docker-compose up --build
```
* Build all services (http-server, ws-server, frontend)
* Start PostgreSQL database
* Start all containers


#### (6) Access the application
```
Frontend → http://localhost:3000
HTTP Server → http://localhost:4000
WebSocket Server → ws://localhost:8080
PostgreSQL → localhost:5432
```