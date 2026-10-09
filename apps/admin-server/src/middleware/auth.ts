import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Not signed in" });

    try {
        const payload = jwt.verify(token, config.jwtSecret, { audience: "rexial-admin" }) as { role?: string };
        if (payload.role !== "SUPER_ADMIN") return res.status(403).json({ error: "Forbidden" });
        next();
    } catch {
        return res.status(401).json({ error: "Session expired, sign in again" });
    }
};
