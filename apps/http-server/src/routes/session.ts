import { Router } from "express";
import { getLeaderboardController, getSessionPollsController, joinQuizController } from "../controllers/sessionController";
import { optionalAuthMiddleware } from "../middlewares/authmiddleware";

const router = Router();

// join quiz
// Optional auth, not required: anyone with a code can play, but a signed-in
// participant must be linked to their account or the quiz never shows up in
// their history.
router.post("/join", optionalAuthMiddleware, joinQuizController)

// get leaderboard
router.get('/:sessionId/leaderboard', getLeaderboardController);

// get session polls
router.get('/:sessionId/polls', getSessionPollsController);






export default router;