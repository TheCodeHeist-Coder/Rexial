_________________ `` Rexial ``________________


**** __Features__ ****

``Basic Version of the App``
### (1) => User can create own quize...(only registerd user)
         -> Only the registerd user on the plateform can create or host live quizes
         -> Host can invite the co-organisers to join the quiz organization via email
         -> if the user is already registerd on the plateform then he'll only accept the email and join as co-host
         -> if he is not registered on the plateform then first he'll register through that mail and  join as co-host
         -> when he is done with creating quiz then generate a code to join the quiz.
         -> With the help of that code, users can join the quiz in realtime ( __WebSockets__).
         -> Organisers can see their full history of organised quizes


### (2) => Participant can take part in the host quiz....
           -> If we want to participate in the quiz then no need to register on the plateform
           -> User can particiapte in the quiz with the  help of ``Code`` provided by the hosts
           -> if the users (especially participant) want to see their all the previous quiz in which they paeticipated then he will have to register on the plateform..
           -> Users can see their scores in real-time after every questing and after the quiz ends, participants can see the overall scores of the indivisuals


### (3) => Setting questions for users as quiz host
           -> Quiz organnisers can set their custom questions by own
           -> and also set the time-limit for each question by own





## ``Advanced Version of the App: Let's see in future``

### (4) => v2 features of app (we'll work on it after creating the basic version of the app:- Mentioned above)

           (i) Social & Collaborative Tools:- Add multiplayer team modes with real-time chat and collaborative editing, where users co-create quizzes live—extending beyond Quizizz's simple team play.​
            Enable social sharing with viral leaderboards, user-generated challenges, and friend invites for competitive leagues.

            Social and collaborative tools evolve quizzes into live social hubs, fostering community and virality like Duolingo's leagues or Kahoot alternatives with real-time rivalry.

            Elaborate Multiplayer Team Modes
            Teams of 2-10 compete in synchronized arenas with role assignments (e.g., strategist, buzzer king) and power-ups like "steal point" earned via chat mini-challenges—expanding Quizizz basics.

            Real-time chat includes emojis, polls for team votes, and voice clips; scores update instantly with confetti for leads.

            Advanced Collaborative Editing
            Live co-creation rooms let 5+ users build quizzes simultaneously: Drag-drop questions, AI auto-complete suggestions, conflict resolution via votes, and branch previews—like Figma for quizzes.

            Changes broadcast with undo stacks; integrate version control for remixing public quizzes into team variants.[ from prior]

            Viral Leaderboards & Sharing
            Tiered leagues (e.g., Novice to Legend) with weekly resets, friend filters, and "ghost replays" of top runs; shareable cards auto-post to socials with climb stats.

            Speed scoring + multipliers for streaks create tension; demotion risks drive daily logins.

            User-Generated Challenges & Leagues
            Creators launch "challenge packs" with custom rules (e.g., themed nights), invite via deep links/QR; leagues auto-form from repeated plays, with creator royalties per entry.[ from prior]
            ​
            Persistent rivalries track head-to-head stats, badges for undefeated streaks.[ from prior]

            Detailed Implementation Blueprint
            Use scalable realtime infra for 1000s of concurrent users.

            Core Stack: Next.js frontend + Node/Express backend + Socket.io or Ably for sync (lobbies, timers, scores).

            Database: Firebase Firestore for rooms/leagues (atomic updates); Redis for live leaderboards.


        (ii) auto genearted quize by uploading the pdf of the content and syllabus   [SHIPPED v2]
        (iii) AI generated quiz in just one prompt with dificulty levels              [SHIPPED v2]










 ## ``v2 Shipped: GenAI Service``

### (5) => AI quiz generation from a PDF

Implemented as a separate Python service at ``apps/genAI`` (FastAPI), so the
AI work stays out of the Node servers and can scale on its own.

**What a host can do now**
-> In the Quiz Builder, click **Generate with AI**
-> Upload a PDF (syllabus, notes, chapter) and describe what they want
   e.g. *"5 medium questions about chapter 2"*
-> The service reads the PDF and writes multiple-choice questions with
   4 options each, one correct answer, and a difficulty label
-> Generated questions land in a **review step** first: the host can edit the
   wording, fix an option, change which answer is correct, or drop a question
-> Nothing is saved to the database until the host confirms

**Endpoints** (see ``apps/genAI/app/main.py``)
-> ``POST /generate-quiz``      structured JSON questions, used by the UI
-> ``POST /generate-questions`` the same thing as a readable text blob
-> ``POST /ask-pdf``            question answering over an uploaded PDF (RAG)
-> ``POST /chat``               general chat, with web search when needed

**How it works**
-> PDF is chunked, embedded with ``sentence-transformers``, and searched
   with an in-memory vector store (RAG)
-> Groq runs question generation; Gemini runs chat; Tavily handles web search
-> Model output is validated before it is returned: any question without
   exactly 4 options and exactly 1 correct answer is discarded rather than
   shown to the host

### Still open on the AI side
-> No persistence of uploaded PDFs between requests (each call re-reads)
-> Question generation is one-shot; no "regenerate this one question" yet
-> No caching, so generating twice from the same PDF costs twice


 ## Schema planning...
 #### Here is the basic version of schema of Rexial

![alt text](<Screenshot From 2026-03-27 10-31-57.png>)
