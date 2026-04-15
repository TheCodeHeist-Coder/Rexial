import { Router } from "express";
import { authMiddleware } from "../middlewares/authmiddleware";
import { acceptInvitationController, inviteCoOrganizerController } from "../controllers/inviteController";

const router:Router = Router();



// invite co-organizers
router.post('/quizzes/:quizId/invite', authMiddleware, inviteCoOrganizerController)


// for accepting the invitation
router.post('/invite/accept/:token', authMiddleware, acceptInvitationController)





export default router;