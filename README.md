# ***Real-Time Quiz Platform***

## 📌 Overview
Rexial is a **real-time quiz hosting platform** where users can create, host, and participate in quizzes seamlessly using a unique join code. It is designed to provide an interactive and engaging experience with live dashboards, avatars, and collaborative hosting.

The platform evolves in multiple versions:

- **Version 1:** Core real-time quiz system  
- **Version 2:** AI-powered quiz generation  
- **Version 3:** Live video-based quiz experience  

---

## 🛠️ Tech Stack

### Monorepo & Tooling
- **TurboRepo** – High-performance monorepo setup  
- **pnpm Workspaces** – Efficient dependency management  

### Frontend
- **React** – UI development  

### Backend
- **Node.js + Express** – API and server logic  
- **WebSockets** – Real-time communication  

### Database
- **PostgreSQL** – Relational database  
- **Prisma ORM** – Type-safe database access  

### Version 2 (AI Features)
- **Python** – AI/ML services for quiz generation  
- **GenAI APIs / LLMs** – Content-based question generation  

### Version 3 (Live Streaming)
- **WebRTC** – Real-time video/audio communication  

---

## ✨ Features

###  Version 1 – Core Features
-  Create and host quizzes  
-  Unique quiz join code system  
-  Participants can join using code  
-  Co-host support  
-  Real-time quiz flow using WebSockets  
-  Live dashboard after each question  
-  Final leaderboard/dashboard at the end  
-  Random avatar assigned to participants  

---

### 🤖 Version 2 – AI Integration
-  Generate quizzes using prompts  
-  Subject-based quiz generation  
-  Upload PDFs/PPTs to auto-generate questions  
-  Smart content understanding using GenAI  
-  Dynamic quiz creation pipeline  

---

### 🎥 Version 3 – Live Streaming Experience
-  Real-time video quiz sessions  
-  Host-guided quiz interactions  
-  Interactive learning environment  
-  Combine live discussion with quiz attempts  
-  Feedback and explanations during quiz  

---

### DevOps & Deployment
- **Docker** – Containerization  
- **GitHub Actions** – CI/CD pipelines  
- **AWS** – Cloud hosting and infrastructure  

### Future DevOps Enhancements
- **Kubernetes** – Container orchestration  
- Advanced scaling and monitoring tools  

---

## 🧩 Architecture Overview

- **Monorepo structure** using TurboRepo  
- Separate apps/services:
  - `frontend` (React)
  - `backend` (Express + WebSockets)
  - `ai-service` (Python – GenAI, V2)
- Real-time communication via **WebSockets**
- Containerized using **Docker**
- CI/CD pipelines via **GitHub Actions**
- Hosted on **AWS**
- Future scalability with **Kubernetes**

---

## 🚀 Getting Started

### Prerequisites
- Node.js  
- pnpm  
- PostgreSQL  

### Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Install dependencies
pnpm install

# Start development
pnpm dev
