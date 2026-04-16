
import { Request, Response } from "express"
import { prisma } from "@repo/db"
import bcrypt from 'bcrypt'
import jwt from "jsonwebtoken"
import { errorResponse } from "../utils/error"


export const userRegisterController = async (req: Request, res: Response) => {

    try {

        const { name, email, password } = req.body;


        // is user existed already
        const isUserExisted = await prisma.user.findUnique({
            where: { email }
        })

        if (isUserExisted) {
            return errorResponse(res, 400, "Email is already existed..")
        }

        const hashedPassword = await bcrypt.hash(password, 10);


        const user = await prisma.user.create({
            data: {
                name,
                password: hashedPassword,
                email
            }
        });

        // generating token...
        const token = jwt.sign({
            userId: user.id
        }, process.env.JWT_SECRET || "secret", { expiresIn: '30d' });

        return res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        })

    } catch (error) {
        return errorResponse(res, 500, "Internal Server Error...")

    }

}




export const userLoginController = async (req: Request, res: Response) => {
    try {

        const { email, password } = req.body;

        if (!email || !password) return errorResponse(res, 400, "All fields are required...");

        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) return errorResponse(res, 404, "No user found. Please signup first....");

        // password matching
        const passwordIsCorrect = await bcrypt.compare(password, user.password);

        if (!passwordIsCorrect) return errorResponse(res, 400, "Invalid Credentials...");

        const token = jwt.sign({
            userId: user.id
        }, process.env.JWT_SECRET || "secret", { expiresIn: '30d' });

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        })

    } catch (error) {
        return errorResponse(res, 500, "Internal Server Errror....")
    }
}


export const getLoggedInUserController = async (req: Request, res: Response) => {
    try {

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, name: true, email: true, createdAt: true }
        })

        if (!user) return errorResponse(res, 404, "User not found...")

        return res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        })

    } catch (error) {
        return errorResponse(res, 500, "Internal Server Error")
    }
}