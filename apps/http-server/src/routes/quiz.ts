import { Router } from "express";
import { authMiddleware } from "../middlewares/authmiddleware";
import { createQuestionController, createQuizController, generateAccessCodeController, getAllQuizesController, getQuizByIdController, startQuizSessionController } from "../controllers/quizController";

const router: Router = Router();


// to create a quiz
router.post("/", authMiddleware, createQuizController);

// to get all the quized i have hosted ever and also the quizes i have participated in
router.get("/", authMiddleware, getAllQuizesController)


// to get a quiz by id
router.get("/:quizId", getQuizByIdController)


// generate or regeneate quiz access code
router.post("/:quizId/generate-access-code", generateAccessCodeController)


// adding questions 
router.post("/:quizId/questions", createQuestionController)





// to create a session for a quiz to join using the access code
router.post("/:quizId/start-session", authMiddleware, startQuizSessionController)


export default router;