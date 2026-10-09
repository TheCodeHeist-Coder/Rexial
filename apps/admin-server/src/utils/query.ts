import { Request } from "express";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

// ?range=7d -> window start. Unknown values fall back to the default
// rather than erroring, so a stale bookmark still loads.
export function rangeOf(req: Request, fallback = "30d") {
    const key = typeof req.query.range === "string" && req.query.range in RANGES ? req.query.range : fallback;
    const days = RANGES[key]!;
    return { key, days, since: new Date(Date.now() - days * DAY_MS) };
}

export function pageOf(req: Request) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    return { page, pageSize, skip: (page - 1) * pageSize };
}

export function str(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// COUNT(*) and friends come back from Postgres as bigint.
export function num(value: unknown) {
    if (value === null || value === undefined) return 0;
    return Number(value);
}

// A session that is still WAITING / IN_PROGRESS this long after it started
// (or, if it never started, after it was created) is abandoned: the host
// closed the tab, and ws-server's cached copy has long expired.
export function staleWhere(hours: number) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return {
        status: { in: ["WAITING" as const, "IN_PROGRESS" as const] },
        OR: [{ startedAt: null, createdAt: { lt: cutoff } }, { startedAt: { lt: cutoff } }],
    };
}

export function liveWhere(hours: number) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return {
        status: { in: ["WAITING" as const, "IN_PROGRESS" as const] },
        OR: [{ startedAt: null, createdAt: { gte: cutoff } }, { startedAt: { gte: cutoff } }],
    };
}

export function isStale(session: { status: string; startedAt: Date | null; createdAt: Date }, hours: number) {
    if (session.status !== "WAITING" && session.status !== "IN_PROGRESS") return false;
    const since = (session.startedAt ?? session.createdAt).getTime();
    return Date.now() - since > hours * 60 * 60 * 1000;
}
