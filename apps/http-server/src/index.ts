import express, { Express } from 'express';
import { configDotenv } from 'dotenv';
configDotenv();

import cors from 'cors'
import authRoutes from "./routes/authRoutes"
import quizzesRoutes from "./routes/quiz"
import quizSessionRoutes from "./routes/session"
import inviteRoutes from './routes/invite'

const app: Express = express()

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT: String = process.env.PORT || '3000';


// routes

app.use("/api/v1/auth", authRoutes)

// quiz routes
app.use("/api/v1/quizzes", quizzesRoutes)

// quiz session routes
app.use("/api/v1/session", quizSessionRoutes)

// invite co-organizer routes:
app.use("/api/v1", inviteRoutes)



app.listen(PORT, () => {
    console.log(`Server: I'm still alive...at ${PORT}`)
})