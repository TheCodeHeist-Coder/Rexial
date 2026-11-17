import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { quizFindMany, sessionFindMany, queryRaw, getRankedParticipants } = vi.hoisted(() => ({
    quizFindMany: vi.fn(),
    sessionFindMany: vi.fn(),
    queryRaw: vi.fn(),
    getRankedParticipants: vi.fn(),
}));

vi.mock("@repo/db", () => ({
    prisma: {
        quiz: { findMany: quizFindMany },
        quizSession: { findMany: sessionFindMany },
        $queryRaw: queryRaw,
    },
    getRankedParticipants,
}));

import { getAllQuizesController } from "./quizController";

const run = async () => {
    const req = { userId: "user-1" } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    await getAllQuizesController(req, res);
    return res;
};

describe("getAllQuizesController podium", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        quizFindMany.mockResolvedValue([
            { id: "quiz-1", status: "COMPLETED" },
            { id: "quiz-2", status: "COMPLETED" },
            { id: "quiz-3", status: "ACTIVE" },
        ]);
        sessionFindMany.mockImplementation((args) =>
            args.where.quizId
                ? [
                    { id: "session-latest", quizId: "quiz-1" },
                    { id: "session-older", quizId: "quiz-1" },
                    { id: "session-quiz-2", quizId: "quiz-2" },
                ]
                : []
        );
        getRankedParticipants.mockResolvedValue([
            { id: "p1", sessionId: "session-latest", username: "Ada", score: 30, totalTimeMs: 200 },
            { id: "p2", sessionId: "session-latest", username: "Lin", score: 30, totalTimeMs: 300 },
            { id: "p3", sessionId: "session-latest", username: "Grace", score: 20, totalTimeMs: 100 },
            { id: "p4", sessionId: "session-latest", username: "Edsger", score: 10, totalTimeMs: 100 },
            { id: "p5", sessionId: "session-quiz-2", username: "Turing", score: 25, totalTimeMs: 400 },
        ]);
    });

    it("loads rankings for only the latest completed sessions in one batch", async () => {
        const res = await run();
        const response = vi.mocked(res.json).mock.calls[0][0];

        expect(sessionFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { quizId: { in: ["quiz-1", "quiz-2"] }, status: "COMPLETED" },
            orderBy: [
                { endedAt: { sort: "desc", nulls: "last" } },
                { createdAt: "desc" },
                { id: "desc" },
            ],
        }));
        expect(quizFindMany).toHaveBeenCalledOnce();
        expect(sessionFindMany).toHaveBeenCalledTimes(2);
        expect(getRankedParticipants).toHaveBeenCalledOnce();
        expect(getRankedParticipants).toHaveBeenCalledWith(["session-latest", "session-quiz-2"]);
        expect(queryRaw).not.toHaveBeenCalled();
        expect(response.organizedQuizes[0].podium).toEqual([
            expect.objectContaining({ username: "Ada", score: 30 }),
            expect.objectContaining({ username: "Lin", score: 30 }),
            expect.objectContaining({ username: "Grace", score: 20 }),
        ]);
        expect(response.organizedQuizes[1].podium).toEqual([
            expect.objectContaining({ username: "Turing", score: 25 }),
        ]);
        expect(response.organizedQuizes[2].podium).toEqual([]);
    });

    it("does not fetch rankings when no completed quiz has a completed session", async () => {
        sessionFindMany.mockResolvedValue([]);

        const res = await run();
        const response = vi.mocked(res.json).mock.calls[0][0];

        expect(getRankedParticipants).not.toHaveBeenCalled();
        expect(response.organizedQuizes[0].podium).toEqual([]);
    });
});
