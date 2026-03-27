import { Router } from "express";
import { userSignUpController } from "../controllers/authController";


const router:Router = Router();


router.post("signup", userSignUpController)






export default  router