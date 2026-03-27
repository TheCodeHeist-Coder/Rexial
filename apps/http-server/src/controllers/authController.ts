
import { Request, Response } from "express"
import { errorResponse } from "../utils/error"

export const userSignUpController = async (req: Request, res: Response) => {

    try {

    } catch (error) {
        console.log("signupError", error)
        return errorResponse(res, 500, "Internal Server Error...")

    }

}