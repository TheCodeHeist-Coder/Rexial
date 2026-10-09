import { Router } from "express";
import { prisma } from "@repo/db";
import { config } from "../config";
import { liveWhere, num, rangeOf, staleWhere } from "../utils/query";

const router: Router = Router();

type SeriesRow = {
    bucket: Date;
    signups: bigint;
    sessions: bigint;
    completed: bigint;
    participants: bigint;
    requests: bigint;
    visitors: bigint;
};

router.get("/", async (req, res) => {
    const { key, days, since } = rangeOf(req);
    const hours = config.staleSessionHours;
    // One day shows hourly buckets; anything longer is daily.
    const unit = days === 1 ? "hour" : "day";
    const buckets = days === 1 ? 24 : days;

    const [
        usersTotal,
        usersNew,
        usersActive,
        quizzesByStatus,
        quizzesNew,
        sessionsByStatus,
        staleSessions,
        participantsTotal,
        participantsNew,
        guestParticipants,
        distinctPlayers,
        questionsTotal,
        answersTotal,
        answersCorrect,
        completedStats,
        live,
        topQuizzes,
        recentUsers,
        series,
        liveSessions,
        liveParticipants,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
        prisma.quiz.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.quiz.count({ where: { createdAt: { gte: since } } }),
        prisma.quizSession.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.quizSession.count({ where: staleWhere(hours) }),
        prisma.participant.count(),
        prisma.participant.count({ where: { joinedAt: { gte: since } } }),
        prisma.participant.count({ where: { userId: null } }),
        prisma.$queryRaw<{ c: bigint }[]>`SELECT count(DISTINCT "userId") AS c FROM "Participant"`
            .then((rows) => num(rows[0]?.c)),
        prisma.question.count(),
        prisma.participantAnswer.count(),
        prisma.participantAnswer.count({ where: { isCorrect: true } }),
        prisma.$queryRaw<{ sessions: bigint; avg_participants: number | null; avg_duration_s: number | null }[]>`
            SELECT count(*) AS sessions,
                   avg(pc.c)::float AS avg_participants,
                   avg(EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")))::float AS avg_duration_s
            FROM "QuizSession" s
            LEFT JOIN (SELECT "sessionId", count(*) AS c FROM "Participant" GROUP BY 1) pc ON pc."sessionId" = s.id
            WHERE s.status = 'COMPLETED'`,
        prisma.quizSession.findMany({
            where: liveWhere(hours),
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
                id: true,
                status: true,
                currentQuestionIndex: true,
                startedAt: true,
                createdAt: true,
                quiz: { select: { id: true, title: true, joinCode: true, _count: { select: { questions: true } } } },
                _count: { select: { participants: true } },
            },
        }),
        prisma.$queryRaw<{ id: string; title: string; creator: string; sessions: bigint; participants: bigint }[]>`
            SELECT q.id, q.title, u.name AS creator,
                   count(DISTINCT s.id) AS sessions, count(p.id) AS participants
            FROM "Quiz" q
            JOIN "User" u ON u.id = q."creatorId"
            LEFT JOIN "QuizSession" s ON s."quizId" = q.id
            LEFT JOIN "Participant" p ON p."sessionId" = s.id
            GROUP BY q.id, u.name
            ORDER BY participants DESC, q."createdAt" DESC
            LIMIT 5`,
        prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { id: true, name: true, email: true, createdAt: true },
        }),
        prisma.$queryRaw<SeriesRow[]>`
            WITH b AS (
                SELECT generate_series(
                    date_trunc(${unit}, now() AT TIME ZONE 'UTC') - (${buckets - 1} * ('1 ' || ${unit})::interval),
                    date_trunc(${unit}, now() AT TIME ZONE 'UTC'),
                    ('1 ' || ${unit})::interval
                ) AS bucket
            ),
            lo AS (SELECT min(bucket) AS t FROM b),
            su AS (SELECT date_trunc(${unit}, "createdAt") AS k, count(*) AS c FROM "User", lo WHERE "createdAt" >= lo.t GROUP BY 1),
            se AS (SELECT date_trunc(${unit}, "createdAt") AS k, count(*) AS c FROM "QuizSession", lo WHERE "createdAt" >= lo.t GROUP BY 1),
            co AS (SELECT date_trunc(${unit}, "endedAt") AS k, count(*) AS c FROM "QuizSession", lo WHERE status = 'COMPLETED' AND "endedAt" >= lo.t GROUP BY 1),
            pa AS (SELECT date_trunc(${unit}, "joinedAt") AS k, count(*) AS c FROM "Participant", lo WHERE "joinedAt" >= lo.t GROUP BY 1),
            rq AS (SELECT date_trunc(${unit}, "createdAt") AS k, count(*) AS c, count(DISTINCT ip) AS v FROM "ApiRequestLog", lo WHERE "createdAt" >= lo.t GROUP BY 1)
            SELECT b.bucket,
                   coalesce(su.c, 0) AS signups,
                   coalesce(se.c, 0) AS sessions,
                   coalesce(co.c, 0) AS completed,
                   coalesce(pa.c, 0) AS participants,
                   coalesce(rq.c, 0) AS requests,
                   coalesce(rq.v, 0) AS visitors
            FROM b
            LEFT JOIN su ON su.k = b.bucket
            LEFT JOIN se ON se.k = b.bucket
            LEFT JOIN co ON co.k = b.bucket
            LEFT JOIN pa ON pa.k = b.bucket
            LEFT JOIN rq ON rq.k = b.bucket
            ORDER BY b.bucket`,
        prisma.quizSession.count({ where: liveWhere(hours) }),
        prisma.participant.count({ where: { session: liveWhere(hours) } }),
    ]);

    const sessionCount = (status: string) => sessionsByStatus.find((s) => s.status === status)?._count._all ?? 0;
    const quizCount = (status: string) => quizzesByStatus.find((q) => q.status === status)?._count._all ?? 0;
    const completed = completedStats[0];

    res.json({
        range: key,
        unit,
        staleSessionHours: config.staleSessionHours,
        users: { total: usersTotal, new: usersNew, active: usersActive },
        quizzes: {
            total: quizzesByStatus.reduce((sum, q) => sum + q._count._all, 0),
            new: quizzesNew,
            draft: quizCount("DRAFT"),
            active: quizCount("ACTIVE"),
            completed: quizCount("COMPLETED"),
            questions: questionsTotal,
        },
        sessions: {
            total: sessionsByStatus.reduce((sum, s) => sum + s._count._all, 0),
            waiting: sessionCount("WAITING"),
            inProgress: sessionCount("IN_PROGRESS"),
            completed: sessionCount("COMPLETED"),
            cancelled: sessionCount("CANCELLED"),
            stale: staleSessions,
            live: liveSessions,
            liveParticipants,
            avgParticipants: completed?.avg_participants ?? 0,
            avgDurationSeconds: completed?.avg_duration_s ?? 0,
        },
        participants: {
            total: participantsTotal,
            new: participantsNew,
            guests: guestParticipants,
            registered: participantsTotal - guestParticipants,
            distinctRegisteredPlayers: distinctPlayers,
        },
        answers: {
            total: answersTotal,
            correct: answersCorrect,
            accuracy: answersTotal ? answersCorrect / answersTotal : 0,
        },
        live: live.map((s) => ({
            id: s.id,
            status: s.status,
            quizId: s.quiz.id,
            quizTitle: s.quiz.title,
            joinCode: s.quiz.joinCode,
            currentQuestion: s.currentQuestionIndex,
            totalQuestions: s.quiz._count.questions,
            participants: s._count.participants,
            startedAt: s.startedAt,
            createdAt: s.createdAt,
        })),
        topQuizzes: topQuizzes.map((q) => ({ ...q, sessions: num(q.sessions), participants: num(q.participants) })),
        recentUsers,
        series: series.map((r) => ({
            bucket: r.bucket,
            signups: num(r.signups),
            sessions: num(r.sessions),
            completed: num(r.completed),
            participants: num(r.participants),
            requests: num(r.requests),
            visitors: num(r.visitors),
        })),
    });
});

export default router;
