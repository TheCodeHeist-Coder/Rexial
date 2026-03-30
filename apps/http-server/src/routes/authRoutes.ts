import { Router } from "express";
import { getLoggedInUserController, userLoginController, userRegisterController } from "../controllers/authController";
import { authMiddleware } from "../middlewares/authmiddleware";


const router:Router = Router();


router.post("/register", userRegisterController)

router.post("/login", userLoginController)

router.get("/me",authMiddleware, getLoggedInUserController)




export default  router