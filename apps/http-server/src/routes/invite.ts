import { Router } from "express";
import { authMiddleware } from "../middlewares/authmiddleware";
import { inviteCoOrganizerController } from "../controllers/inviteController";

const router:Router = Router();



// invite co-organizers
router.post('/quizzes/:quizId/invite', authMiddleware, inviteCoOrganizerController)






export default router;