import { Router } from "express";
import { prisma, Prisma } from "@repo/db";
import { num, pageOf, str } from "../utils/query";

const router: Router = Router();

const SORTS: Record<string, Prisma.UserOrderByWithRelationInput> = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    lastLogin: { lastLoginAt: { sort: "desc", nulls: "last" } },
    name: { name: "asc" },
};

// Never select `password` in this file: every field below may end up in
// the browser or a CSV.
const PUBLIC_FIELDS = {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    lastLoginAt: true,
    _count: { select: { quizzes: true, participants: true } },
} satisfies Prisma.UserSelect;

function searchWhere(search?: string): Prisma.UserWhereInput {
    if (!search) return {};
    return {
        OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
        ],
    };
}

router.get("/", async (req, res) => {
    const { page, pageSize, skip } = pageOf(req);
    const where = searchWhere(str(req.query.search));
    const orderBy = SORTS[String(req.query.sort)] ?? SORTS.newest!;

    const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({ where, orderBy, skip, take: pageSize, select: PUBLIC_FIELDS }),
    ]);

    const ids = users.map((u) => u.id);
    const [scores, requests] = ids.length
        ? await Promise.all([
            prisma.participant.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _sum: { score: true } }),
            prisma.apiRequestLog.groupBy({
                by: ["userId"],
                where: { userId: { in: ids } },
                _count: { _all: true },
                _max: { createdAt: true },
            }),
        ])
        : [[], []];
    const scoreOf = new Map(scores.map((s) => [s.userId, s._sum.score ?? 0]));
    const activityOf = new Map(requests.map((r) => [r.userId, r]));

    res.json({
        total,
        page,
        pageSize,
        items: users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            createdAt: u.createdAt,
            lastLoginAt: u.lastLoginAt,
            lastSeenAt: activityOf.get(u.id)?._max.createdAt ?? null,
            requests: activityOf.get(u.id)?._count._all ?? 0,
            quizzesCreated: u._count.quizzes,
            quizzesPlayed: u._count.participants,
            totalScore: scoreOf.get(u.id) ?? 0,
        })),
    });
});

function csvCell(value: unknown) {
    const text = value instanceof Date ? value.toISOString() : String(value ?? "");
    // Leading = + - @ would run as a formula when the file is opened in a
    // spreadsheet, so those cells are prefixed with a quote.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

router.get("/export.csv", async (req, res) => {
    const users = await prisma.user.findMany({
        where: searchWhere(str(req.query.search)),
        orderBy: { createdAt: "desc" },
        select: PUBLIC_FIELDS,
    });

    const header = ["id", "name", "email", "signed_up", "last_login", "quizzes_created", "quizzes_played"];
    const lines = users.map((u) =>
        [u.id, u.name, u.email, u.createdAt, u.lastLoginAt, u._count.quizzes, u._count.participants]
            .map(csvCell)
            .join(","),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="rexial-users-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send([header.join(","), ...lines].join("\n"));
});

router.get("/:id", async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            ...PUBLIC_FIELDS,
            quizzes: {
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    createdAt: true,
                    _count: { select: { questions: true, quizSessions: true } },
                },
            },
            quizOrganizers: {
                where: { role: "CO_ORGANIZER" },
                select: { role: true, inviteStatus: true, quiz: { select: { id: true, title: true } } },
            },
            participants: {
                orderBy: { joinedAt: "desc" },
                take: 50,
                select: {
                    id: true,
                    username: true,
                    score: true,
                    joinedAt: true,
                    session: { select: { id: true, status: true, quiz: { select: { id: true, title: true } } } },
                    _count: { select: { answers: true } },
                },
            },
        },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentRequests, requests30d, ips, correct] = await Promise.all([
        prisma.apiRequestLog.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 25,
            select: { id: true, method: true, path: true, statusCode: true, durationMs: true, ip: true, createdAt: true },
        }),
        prisma.apiRequestLog.count({ where: { userId: user.id, createdAt: { gte: since } } }),
        prisma.apiRequestLog.groupBy({
            by: ["ip", "userAgent"],
            where: { userId: user.id },
            _count: { _all: true },
            _max: { createdAt: true },
            orderBy: { _max: { createdAt: "desc" } },
            take: 10,
        }),
        prisma.participantAnswer.count({ where: { participant: { userId: user.id }, isCorrect: true } }),
    ]);
    const answered = user.participants.reduce((sum, p) => sum + p._count.answers, 0);

    res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        stats: {
            quizzesCreated: user._count.quizzes,
            quizzesPlayed: user._count.participants,
            totalScore: user.participants.reduce((sum, p) => sum + p.score, 0),
            answered,
            correct,
            requests30d,
        },
        quizzes: user.quizzes.map((q) => ({
            id: q.id,
            title: q.title,
            status: q.status,
            createdAt: q.createdAt,
            questions: q._count.questions,
            sessions: q._count.quizSessions,
        })),
        coOrganizing: user.quizOrganizers.map((o) => ({ ...o.quiz, inviteStatus: o.inviteStatus })),
        participations: user.participants.map((p) => ({
            id: p.id,
            username: p.username,
            score: p.score,
            joinedAt: p.joinedAt,
            answered: p._count.answers,
            sessionId: p.session.id,
            sessionStatus: p.session.status,
            quiz: p.session.quiz,
        })),
        devices: ips.map((d) => ({
            ip: d.ip,
            userAgent: d.userAgent,
            requests: num(d._count._all),
            lastSeen: d._max.createdAt,
        })),
        recentRequests: recentRequests.map((r) => ({ ...r, id: r.id.toString() })),
    });
});

export default router;
