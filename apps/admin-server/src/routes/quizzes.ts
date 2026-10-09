import { Router } from "express";
import { prisma, Prisma } from "@repo/db";
import { config } from "../config";
import { isStale, num, pageOf, str } from "../utils/query";

const router: Router = Router();
const STATUSES = ["DRAFT", "ACTIVE", "COMPLETED"] as const;

router.get("/", async (req, res) => {
    const { page, pageSize, skip } = pageOf(req);
    const search = str(req.query.search);
    const status = STATUSES.find((s) => s === req.query.status);

    const where: Prisma.QuizWhereInput = {
        ...(status && { status }),
        ...(search && {
            OR: [
                { title: { contains: search, mode: "insensitive" } },
                { joinCode: { equals: search.toUpperCase() } },
                { creator: { email: { contains: search, mode: "insensitive" } } },
                { creator: { name: { contains: search, mode: "insensitive" } } },
            ],
        }),
    };

    const [total, quizzes] = await Promise.all([
        prisma.quiz.count({ where }),
        prisma.quiz.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
                id: true,
                title: true,
                status: true,
                joinCode: true,
                createdAt: true,
                creator: { select: { id: true, name: true, email: true } },
                _count: { select: { questions: true, quizSessions: true, quizOrganizers: true } },
            },
        }),
    ]);

    const ids = quizzes.map((q) => q.id);
    const counts = ids.length
        ? await prisma.$queryRaw<{ quizId: string; participants: bigint; lastPlayed: Date | null }[]>`
            SELECT s."quizId", count(p.id) AS participants, max(s."createdAt") AS "lastPlayed"
            FROM "QuizSession" s
            LEFT JOIN "Participant" p ON p."sessionId" = s.id
            WHERE s."quizId" = ANY(${ids})
            GROUP BY s."quizId"`
        : [];
    const byQuiz = new Map(counts.map((c) => [c.quizId, c]));

    res.json({
        total,
        page,
        pageSize,
        items: quizzes.map((q) => ({
            id: q.id,
            title: q.title,
            status: q.status,
            joinCode: q.joinCode,
            createdAt: q.createdAt,
            creator: q.creator,
            questions: q._count.questions,
            sessions: q._count.quizSessions,
            organizers: q._count.quizOrganizers,
            participants: num(byQuiz.get(q.id)?.participants),
            lastPlayed: byQuiz.get(q.id)?.lastPlayed ?? null,
        })),
    });
});

router.get("/:id", async (req, res) => {
    const quiz = await prisma.quiz.findUnique({
        where: { id: req.params.id },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            quizOrganizers: {
                orderBy: { createdAt: "asc" },
                select: {
                    id: true,
                    role: true,
                    inviteStatus: true,
                    inviteEmail: true,
                    createdAt: true,
                    user: { select: { id: true, name: true, email: true } },
                },
            },
            questions: {
                orderBy: { order: "asc" },
                select: {
                    id: true,
                    text: true,
                    order: true,
                    timeLimit: true,
                    difficulty: true,
                    answers: { select: { id: true, text: true, isCorrect: true } },
                },
            },
            quizSessions: {
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    startedAt: true,
                    endedAt: true,
                    _count: { select: { participants: true } },
                },
            },
        },
    });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    const questionStats = await prisma.participantAnswer.groupBy({
        by: ["questionId", "isCorrect"],
        where: { question: { quizId: quiz.id } },
        _count: { _all: true },
        _avg: { timeMs: true },
    });

    const statsFor = (questionId: string) => {
        const rows = questionStats.filter((r) => r.questionId === questionId);
        const answered = rows.reduce((sum, r) => sum + r._count._all, 0);
        const correct = rows.find((r) => r.isCorrect)?._count._all ?? 0;
        const totalTime = rows.reduce((sum, r) => sum + (r._avg.timeMs ?? 0) * r._count._all, 0);
        return { answered, correct, avgTimeMs: answered ? Math.round(totalTime / answered) : null };
    };

    res.json({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        status: quiz.status,
        joinCode: quiz.joinCode,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        creator: quiz.creator,
        organizers: quiz.quizOrganizers,
        questions: quiz.questions.map((q) => ({ ...q, ...statsFor(q.id) })),
        sessions: quiz.quizSessions.map((s) => ({
            id: s.id,
            status: s.status,
            createdAt: s.createdAt,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            participants: s._count.participants,
            stale: isStale(s, config.staleSessionHours),
        })),
        totalParticipants: quiz.quizSessions.reduce((sum, s) => sum + s._count.participants, 0),
    });
});

export default router;
