import { Router } from "express";
import rateLimit, { MemoryStore } from "express-rate-limit";
import { getLeaderboardController, getSessionPollsController, joinQuizController } from "../controllers/sessionController";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authmiddleware";
import { errorResponse } from "../utils/error";

const router = Router();

export const SESSION_POLLS_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const SESSION_POLLS_RATE_LIMIT_MAX = 60;

export const sessionPollsRateLimitStore = new MemoryStore();

export const sessionPollsRateLimiter = rateLimit({
    windowMs: SESSION_POLLS_RATE_LIMIT_WINDOW_MS,
    limit: SESSION_POLLS_RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    store: sessionPollsRateLimitStore,
    handler: (_req, res) => errorResponse(res, 429, "Too many requests, please try again later."),
});

// join quiz
// Optional auth, not required: anyone with a code can play, but a signed-in
// participant must be linked to their account or the quiz never shows up in
// their history.
router.post("/join", optionalAuthMiddleware, joinQuizController)

// get leaderboard
router.get('/:sessionId/leaderboard', getLeaderboardController);

// get session polls (restricted to accepted organizers of the session's quiz)
router.get('/:sessionId/polls', sessionPollsRateLimiter, authMiddleware, getSessionPollsController);






export default router;
