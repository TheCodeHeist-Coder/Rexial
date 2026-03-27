import express, { Express } from 'express';
import { configDotenv } from 'dotenv';
configDotenv();

import authRoutes from "./routes/authRoutes"

const app: Express = express()

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT: String = process.env.PORT || '3000';


// routes

app.use("/api/v1/auth", authRoutes)





app.listen(PORT, () => {
    console.log(`Server: I'm still alive...at ${PORT}`)
})