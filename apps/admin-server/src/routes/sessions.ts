import { Router } from "express";
import { prisma, Prisma } from "@repo/db";
import { config } from "../config";
import { isStale, liveWhere, pageOf, staleWhere, str } from "../utils/query";

const router: Router = Router();
const STATUSES = ["WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

router.get("/", async (req, res) => {
    const { page, pageSize, skip } = pageOf(req);
    const hours = config.staleSessionHours;
    const search = str(req.query.search);

    // Besides the stored statuses the panel can ask for "LIVE" (running
    // right now) and "STALE" (abandoned, eligible for cancelling).
    const filter = str(req.query.status);
    const statusWhere: Prisma.QuizSessionWhereInput =
        filter === "LIVE" ? liveWhere(hours)
        : filter === "STALE" ? staleWhere(hours)
        : STATUSES.find((s) => s === filter) ? { status: filter as (typeof STATUSES)[number] }
        : {};

    const where: Prisma.QuizSessionWhereInput = {
        ...statusWhere,
        ...(search && { quiz: { title: { contains: search, mode: "insensitive" } } }),
    };

    const [total, sessions] = await Promise.all([
        prisma.quizSession.count({ where }),
        prisma.quizSession.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
            select: {
                id: true,
                status: true,
                currentQuestionIndex: true,
                createdAt: true,
                startedAt: true,
                endedAt: true,
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        creator: { select: { id: true, name: true, email: true } },
                        _count: { select: { questions: true } },
                    },
                },
                _count: { select: { participants: true } },
            },
        }),
    ]);

    res.json({
        total,
        page,
        pageSize,
        items: sessions.map((s) => ({
            id: s.id,
            status: s.status,
            stale: isStale(s, hours),
            quiz: { id: s.quiz.id, title: s.quiz.title },
            host: s.quiz.creator,
            participants: s._count.participants,
            currentQuestion: s.currentQuestionIndex,
            totalQuestions: s.quiz._count.questions,
            createdAt: s.createdAt,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
        })),
    });
});

router.get("/:id", async (req, res) => {
    const session = await prisma.quizSession.findUnique({
        where: { id: req.params.id },
        include: {
            quiz: {
                select: {
                    id: true,
                    title: true,
                    creator: { select: { id: true, name: true, email: true } },
                    questions: { orderBy: { order: "asc" }, select: { id: true, text: true, order: true } },
                },
            },
            participants: {
                orderBy: { score: "desc" },
                select: {
                    id: true,
                    username: true,
                    score: true,
                    joinedAt: true,
                    user: { select: { id: true, name: true, email: true } },
                    _count: { select: { answers: true } },
                },
            },
        },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const [correctByParticipant, byQuestion] = await Promise.all([
        prisma.participantAnswer.groupBy({
            by: ["participantId"],
            where: { participant: { sessionId: session.id }, isCorrect: true },
            _count: { _all: true },
        }),
        prisma.participantAnswer.groupBy({
            by: ["questionId", "isCorrect"],
            where: { participant: { sessionId: session.id } },
            _count: { _all: true },
            _avg: { timeMs: true },
        }),
    ]);
    const correct = new Map(correctByParticipant.map((r) => [r.participantId, r._count._all]));

    res.json({
        id: session.id,
        status: session.status,
        stale: isStale(session, config.staleSessionHours),
        currentQuestion: session.currentQuestionIndex,
        createdAt: session.createdAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        quiz: { id: session.quiz.id, title: session.quiz.title },
        host: session.quiz.creator,
        participants: session.participants.map((p, i) => ({
            id: p.id,
            rank: i + 1,
            username: p.username,
            score: p.score,
            joinedAt: p.joinedAt,
            user: p.user,
            answered: p._count.answers,
            correct: correct.get(p.id) ?? 0,
        })),
        questions: session.quiz.questions.map((q) => {
            const rows = byQuestion.filter((r) => r.questionId === q.id);
            const answered = rows.reduce((sum, r) => sum + r._count._all, 0);
            const totalTime = rows.reduce((sum, r) => sum + (r._avg.timeMs ?? 0) * r._count._all, 0);
            return {
                ...q,
                answered,
                correct: rows.find((r) => r.isCorrect)?._count._all ?? 0,
                avgTimeMs: answered ? Math.round(totalTime / answered) : null,
            };
        }),
    });
});

// Closes an abandoned session. Only stale sessions qualify: a live one is
// still driven by ws-server, which would overwrite the status when it ends.
router.post("/:id/cancel", async (req, res) => {
    const session = await prisma.quizSession.findUnique({ where: { id: req.params.id } });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!isStale(session, config.staleSessionHours)) {
        return res.status(409).json({
            error: `Only sessions idle for more than ${config.staleSessionHours}h can be cancelled`,
        });
    }

    await prisma.$transaction(async (tx) => {
        await tx.quizSession.update({
            where: { id: session.id },
            data: { status: "CANCELLED", endedAt: new Date() },
        });
        // Drop the join code with it, as ending a session normally does, so
        // nobody joins a quiz whose host is gone. Back to DRAFT so the host
        // can relaunch it. Skipped if another session of the quiz is live.
        const otherLive = await tx.quizSession.count({
            where: { quizId: session.quizId, id: { not: session.id }, ...liveWhere(config.staleSessionHours) },
        });
        if (!otherLive) {
            await tx.quiz.updateMany({
                where: { id: session.quizId, status: "ACTIVE" },
                data: { status: "DRAFT", joinCode: null },
            });
        }
    });

    res.json({ ok: true });
});

export default router;
