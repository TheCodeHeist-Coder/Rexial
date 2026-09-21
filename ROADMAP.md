# Rexial Roadmap

Where the project is going. Anything unchecked is open — if you want to work on
something here, open an issue saying so and we will scope it with you.

## v1 — Real-time quizzes (shipped)

- [x] Quiz creation and hosting for registered users
- [x] Unique join code, no account needed for participants
- [x] Co-host invitations by email
- [x] Real-time quiz flow over WebSockets
- [x] Live dashboard after every question
- [x] Final leaderboard
- [x] Random avatars for participants
- [x] Quiz history for organisers

## v2 — AI quiz generation (shipped)

- [x] PDF upload → generated multiple-choice questions
- [x] Prompt-driven generation (count, difficulty, topic)
- [x] Host review step before anything is saved
- [x] Output validation (exactly 4 options, exactly 1 correct answer)
- [x] RAG question answering over an uploaded PDF (`/ask-pdf`)
- [x] Chat with web search (`/chat`)
- [ ] Regenerate a single question without redoing the whole set
- [ ] Cache the vector store per PDF so repeat requests skip embedding
- [ ] Persist uploaded PDFs between requests
- [ ] PPT and DOCX input alongside PDF

## v3 — Live video quizzes (planned)

- [ ] WebRTC host streaming
- [ ] Participant interaction during a live session
- [ ] In-quiz explanations after each question
- [ ] Recording and replay

## Infrastructure and scaling

- [x] Dockerised development environment
- [x] GitHub Actions CI (lint, type-check, build)
- [x] Redis for pub/sub and live leaderboards
- [x] WebSocket latency work — 466ms → ~9ms at thousands of concurrent users
- [ ] Horizontal WebSocket scaling across multiple nodes
- [ ] Kubernetes deployment
- [ ] Metrics and monitoring
- [ ] Automated test suite — currently the largest gap
- [ ] Load-testing harness

## Quality and developer experience

- [ ] Clear the ~20 eslint errors and make lint a blocking CI gate
- [ ] API documentation for the REST endpoints
- [ ] End-to-end test covering a full quiz run
- [ ] Mobile-responsive leaderboard and quiz screens
- [ ] Accessibility pass on the participant flow

---

Want to pick something up? Check
[good first issues](https://github.com/TheCodeHeist-Coder/Rexial/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
or read [CONTRIBUTING.md](CONTRIBUTING.md).
