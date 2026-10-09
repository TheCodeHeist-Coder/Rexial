import { NextFunction, Request, Response } from "express";
import { prisma } from "@repo/db";

// Traffic data for the super-admin panel. Requests are buffered in memory
// and written in batches, so logging never adds a database round trip to
// the request itself.

type LogRow = {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    ip: string | null;
    userId: string | null;
    userAgent: string | null;
    createdAt: Date;
};

const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_AT = 500;
// If the database is down the buffer must not grow without bound.
const MAX_BUFFER = 10_000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_DAYS = Number(process.env.REQUEST_LOG_RETENTION_DAYS) || 30;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

let buffer: LogRow[] = [];
let flushing = false;

async function flush() {
    if (flushing || buffer.length === 0) return;
    flushing = true;
    const rows = buffer;
    buffer = [];
    try {
        await prisma.apiRequestLog.createMany({ data: rows });
    } catch (error) {
        console.log("Request log flush failed, dropping", rows.length, "rows", error);
    } finally {
        flushing = false;
    }
}

async function prune() {
    try {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await prisma.apiRequestLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    } catch (error) {
        console.log("Request log prune failed", error);
    }
}

setInterval(flush, FLUSH_INTERVAL_MS).unref();
setInterval(prune, PRUNE_INTERVAL_MS).unref();

// A deploy stops the container with SIGTERM; write what is still buffered
// first, but never let a slow database hold the shutdown past 3 seconds.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, async () => {
        setTimeout(() => process.exit(0), 3_000).unref();
        while (flushing) await new Promise((r) => setTimeout(r, 50));
        await flush();
        process.exit(0);
    });
}

// Groups /quizzes/<uuid>/questions and /quizzes/<other-uuid>/questions under
// one route, so the panel can rank endpoints instead of individual URLs.
function routeOf(req: Request) {
    if (req.route?.path) return `${req.baseUrl}${req.route.path}`;
    return req.path.replace(UUID, ":id").slice(0, 200);
}

function clientIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    return first || req.socket.remoteAddress || null;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on("finish", () => {
        if (req.method === "OPTIONS") return;
        if (buffer.length >= MAX_BUFFER) return;

        buffer.push({
            method: req.method,
            path: routeOf(req),
            statusCode: res.statusCode,
            durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
            ip: clientIp(req),
            userId: req.userId || null,
            userAgent: req.headers["user-agent"]?.slice(0, 300) || null,
            createdAt: new Date(),
        });

        if (buffer.length >= FLUSH_AT) void flush();
    });

    next();
};
