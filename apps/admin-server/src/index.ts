import "dotenv/config";
import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import { config } from "./config";
import { requireAdmin } from "./middleware/auth";
import authRoutes from "./routes/auth";
import overviewRoutes from "./routes/overview";
import quizRoutes from "./routes/quizzes";
import sessionRoutes from "./routes/sessions";
import userRoutes from "./routes/users";
import trafficRoutes from "./routes/traffic";

const app: Express = express();

// Render, Railway and friends sit behind one proxy hop; this makes req.ip
// the real client, which the login rate limit keys on.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(cors({ origin: config.origins }));
app.use(express.json({ limit: "10kb" }));
app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

app.use("/api/admin/auth", authRoutes);
app.use("/api/admin/overview", requireAdmin, overviewRoutes);
app.use("/api/admin/quizzes", requireAdmin, quizRoutes);
app.use("/api/admin/sessions", requireAdmin, sessionRoutes);
app.use("/api/admin/users", requireAdmin, userRoutes);
app.use("/api/admin/traffic", requireAdmin, trafficRoutes);

app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
});

// Express 5 forwards rejected async handlers here.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.log("Admin API error:", error);
    res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
    console.log(`Admin API listening on ${config.port}`);
});
