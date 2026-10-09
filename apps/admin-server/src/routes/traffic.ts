import { Router } from "express";
import { prisma } from "@repo/db";
import { num, rangeOf } from "../utils/query";

const router: Router = Router();

router.get("/", async (req, res) => {
    const { key, days, since } = rangeOf(req, "7d");
    const unit = days === 1 ? "hour" : "day";
    const buckets = days === 1 ? 24 : days;

    const [totals, series, endpoints, statuses, topIps, recentErrors, userAgents] = await Promise.all([
        prisma.$queryRaw<{
            requests: bigint;
            visitors: bigint;
            users: bigint;
            client_errors: bigint;
            server_errors: bigint;
            avg_ms: number | null;
            p95_ms: number | null;
        }[]>`
            SELECT count(*) AS requests,
                   count(DISTINCT ip) AS visitors,
                   count(DISTINCT "userId") AS users,
                   count(*) FILTER (WHERE "statusCode" BETWEEN 400 AND 499) AS client_errors,
                   count(*) FILTER (WHERE "statusCode" >= 500) AS server_errors,
                   avg("durationMs")::float AS avg_ms,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS p95_ms
            FROM "ApiRequestLog"
            WHERE "createdAt" >= ${since}`,
        prisma.$queryRaw<{ bucket: Date; requests: bigint; visitors: bigint; errors: bigint; p95_ms: number | null }[]>`
            WITH b AS (
                SELECT generate_series(
                    date_trunc(${unit}, now() AT TIME ZONE 'UTC') - (${buckets - 1} * ('1 ' || ${unit})::interval),
                    date_trunc(${unit}, now() AT TIME ZONE 'UTC'),
                    ('1 ' || ${unit})::interval
                ) AS bucket
            ),
            r AS (
                SELECT date_trunc(${unit}, "createdAt") AS k,
                       count(*) AS requests,
                       count(DISTINCT ip) AS visitors,
                       count(*) FILTER (WHERE "statusCode" >= 500) AS errors,
                       percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS p95_ms
                FROM "ApiRequestLog"
                WHERE "createdAt" >= (SELECT min(bucket) FROM b)
                GROUP BY 1
            )
            SELECT b.bucket, coalesce(r.requests, 0) AS requests, coalesce(r.visitors, 0) AS visitors,
                   coalesce(r.errors, 0) AS errors, r.p95_ms
            FROM b LEFT JOIN r ON r.k = b.bucket
            ORDER BY b.bucket`,
        prisma.$queryRaw<{ method: string; path: string; requests: bigint; errors: bigint; avg_ms: number; p95_ms: number }[]>`
            SELECT method, path, count(*) AS requests,
                   count(*) FILTER (WHERE "statusCode" >= 400) AS errors,
                   avg("durationMs")::float AS avg_ms,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS p95_ms
            FROM "ApiRequestLog"
            WHERE "createdAt" >= ${since}
            GROUP BY method, path
            ORDER BY requests DESC
            LIMIT 20`,
        prisma.$queryRaw<{ statusCode: number; requests: bigint }[]>`
            SELECT "statusCode", count(*) AS requests
            FROM "ApiRequestLog"
            WHERE "createdAt" >= ${since}
            GROUP BY 1 ORDER BY 2 DESC`,
        prisma.$queryRaw<{ ip: string | null; requests: bigint; users: bigint; errors: bigint; last_seen: Date }[]>`
            SELECT ip, count(*) AS requests, count(DISTINCT "userId") AS users,
                   count(*) FILTER (WHERE "statusCode" >= 400) AS errors,
                   max("createdAt") AS last_seen
            FROM "ApiRequestLog"
            WHERE "createdAt" >= ${since}
            GROUP BY ip
            ORDER BY requests DESC
            LIMIT 15`,
        prisma.apiRequestLog.findMany({
            where: { createdAt: { gte: since }, statusCode: { gte: 400 } },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, method: true, path: true, statusCode: true, durationMs: true, ip: true, userId: true, createdAt: true },
        }),
        prisma.$queryRaw<{ userAgent: string | null; requests: bigint }[]>`
            SELECT "userAgent", count(*) AS requests
            FROM "ApiRequestLog"
            WHERE "createdAt" >= ${since}
            GROUP BY 1 ORDER BY 2 DESC
            LIMIT 200`,
    ]);

    const t = totals[0];
    const requests = num(t?.requests);

    res.json({
        range: key,
        unit,
        totals: {
            requests,
            visitors: num(t?.visitors),
            users: num(t?.users),
            clientErrors: num(t?.client_errors),
            serverErrors: num(t?.server_errors),
            errorRate: requests ? num(t?.server_errors) / requests : 0,
            avgMs: t?.avg_ms ?? 0,
            p95Ms: t?.p95_ms ?? 0,
        },
        series: series.map((r) => ({
            bucket: r.bucket,
            requests: num(r.requests),
            visitors: num(r.visitors),
            errors: num(r.errors),
            p95Ms: r.p95_ms,
        })),
        endpoints: endpoints.map((e) => ({ ...e, requests: num(e.requests), errors: num(e.errors) })),
        statuses: statuses.map((s) => ({ statusCode: s.statusCode, requests: num(s.requests) })),
        topIps: topIps.map((i) => ({
            ip: i.ip,
            requests: num(i.requests),
            users: num(i.users),
            errors: num(i.errors),
            lastSeen: i.last_seen,
        })),
        clients: summarizeClients(userAgents.map((u) => ({ ua: u.userAgent, requests: num(u.requests) }))),
        recentErrors: recentErrors.map((e) => ({ ...e, id: e.id.toString() })),
    });
});

// Coarse browser / OS split from user-agent strings. Good enough for "who
// uses the app from where"; not a fingerprinting tool.
function summarizeClients(rows: { ua: string | null; requests: number }[]) {
    const browsers = new Map<string, number>();
    const platforms = new Map<string, number>();
    const add = (map: Map<string, number>, k: string, n: number) => map.set(k, (map.get(k) ?? 0) + n);

    for (const { ua, requests } of rows) {
        const s = ua ?? "";
        const browser =
            /bot|crawl|spider|curl|wget|python|axios|node|postman/i.test(s) ? "Bots & scripts"
            : /Edg\//.test(s) ? "Edge"
            : /OPR\//.test(s) ? "Opera"
            : /Firefox\//.test(s) ? "Firefox"
            : /Chrome\//.test(s) ? "Chrome"
            : /Safari\//.test(s) ? "Safari"
            : "Other";
        const platform =
            /Android/i.test(s) ? "Android"
            : /iPhone|iPad|iOS/i.test(s) ? "iOS"
            : /Windows/i.test(s) ? "Windows"
            : /Mac OS X|Macintosh/i.test(s) ? "macOS"
            : /Linux/i.test(s) ? "Linux"
            : "Other";
        add(browsers, browser, requests);
        add(platforms, platform, requests);
    }

    const sorted = (map: Map<string, number>) =>
        [...map].map(([name, requests]) => ({ name, requests })).sort((a, b) => b.requests - a.requests);
    return { browsers: sorted(browsers), platforms: sorted(platforms) };
}

export default router;
