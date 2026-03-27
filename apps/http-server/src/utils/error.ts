import { Response } from "express";

export const errorResponse = (res:Response, statusCode:number, message:string) => {
    return res.status(statusCode).json({
        success:false,
        error: message
    })
}