import { Router } from "express";
import { getLeaderboardController, joinQuizController } from "../controllers/sessionController";

const router = Router();

// join quiz
router.post("/join", joinQuizController)

// get leaderboard
router.get('/:sessionId/leaderboard', getLeaderboardController);





export default router;