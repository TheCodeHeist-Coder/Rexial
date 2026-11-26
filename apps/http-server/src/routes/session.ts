import { Router } from "express";
import { getLeaderboardController, getSessionPollsController, joinQuizController } from "../controllers/sessionController";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authmiddleware";

const router = Router();

// join quiz
// Optional auth, not required: anyone with a code can play, but a signed-in
// participant must be linked to their account or the quiz never shows up in
// their history.
router.post("/join", optionalAuthMiddleware, joinQuizController)

// get leaderboard
router.get('/:sessionId/leaderboard', getLeaderboardController);

// get session polls (restricted to accepted organizers of the session's quiz)
router.get('/:sessionId/polls', authMiddleware, getSessionPollsController);






export default router;