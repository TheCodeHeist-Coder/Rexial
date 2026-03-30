import { NextFunction, Request, Response } from "express";
import { errorResponse } from "../utils/error";
import jwt from "jsonwebtoken";

// export interface AuthRequest extends Request {
//     userId?: string
// }

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const authHeader = req.headers["authorization"];


        if (!authHeader || !authHeader.startsWith('Bearer ')) return errorResponse(res, 401, "You're not authorized...")

        const token = authHeader.split(' ')[1];

        if (!token) return errorResponse(res, 401, "You're not authorized...")

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as { userId: string }
        req.userId = decoded.userId;
        next();

    } catch (error) {
        console.log("Error in authentication", error);
        return errorResponse(res, 500, "Internal Server Error...")
    }
}