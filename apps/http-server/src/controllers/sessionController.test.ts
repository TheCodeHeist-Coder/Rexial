import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";

const { findUnique, participantCreate, transaction, pollFindMany, organizerFindFirst } = vi.hoisted(() => ({
    findUnique: vi.fn(),
    participantCreate: vi.fn(),
    transaction: vi.fn(),
    pollFindMany: vi.fn(),
    organizerFindFirst: vi.fn(),
}));

vi.mock("@repo/db", () => ({
    prisma: {
        quiz: { findUnique },
        poll: { findMany: pollFindMany },
        quizOrganizer: { findFirst: organizerFindFirst },
        $transaction: transaction,
    },
}));

import sessionRouter, { SESSION_POLLS_RATE_LIMIT_MAX, sessionPollsRateLimitStore } from "../routes/session";
import { getSessionPollsController, joinQuizController } from "./sessionController";

const run = async (body: unknown) => {
    const req = { body } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    await joinQuizController(req, res);
    return res;
};

describe("joinQuizController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ["an empty body", {}],
        ["no username", { code: "ABC123" }],
        ["no code", { username: "ada" }],
        ["an empty username", { code: "ABC123", username: "" }],
        ["a blank username", { code: "ABC123", username: "   " }],
        ["no body at all", undefined],
    ])("answers 400 with { success, error } for %s and never reads the quiz", async (_label, body) => {
        const res = await run(body);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Code and username are required" });
        expect(findUnique).not.toHaveBeenCalled();
    });

    it.each([
        ["an object username", { code: "ABC123", username: {} }, "username must be a string"],
        ["an array username", { code: "ABC123", username: ["ada"] }, "username must be a string"],
        ["a numeric username", { code: "ABC123", username: 42 }, "username must be a string"],
        ["an object code", { code: { contains: "A" }, username: "ada" }, "code must be a string"],
        ["an array code", { code: ["ABC123"], username: "ada" }, "code must be a string"],
        ["a 31 character username", { code: "ABC123", username: "a".repeat(31) }, "username must be at most 30 characters"],
    ])("answers 400 for %s instead of reaching prisma", async (_label, body, message) => {
        const res = await run(body);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: message });
        expect(findUnique).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
    });

    it("stores the trimmed username", async () => {
        findUnique.mockResolvedValue({
            id: "quiz-1",
            title: "Quiz",
            status: "ACTIVE",
            quizSessions: [{ id: "session-1", liveVideo: false }],
        });
        participantCreate.mockResolvedValue({ id: "participant-1" });
        transaction.mockImplementation((fn) => fn({ participant: { create: participantCreate } }));

        const res = await run({ code: "ABC123", username: "  ada  " });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { joinCode: "ABC123" } }));
        expect(participantCreate).toHaveBeenCalledWith({
            data: { username: "ada", sessionId: "session-1", userId: null },
        });
    });

    it("answers 404 in the same shape when the quiz does not exist", async () => {
        findUnique.mockResolvedValue(null);
        const res = await run({ code: "NOPE00", username: "ada" });

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Quiz not found" });
    });
});

describe("getSessionPollsController", () => {
    const SECRET = "test-secret";

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.stubEnv("JWT_SECRET", SECRET);
        await sessionPollsRateLimitStore.resetAll();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("returns polls for an accepted organizer of the session's quiz", async () => {
        const mockPolls = [
            {
                id: "poll-1",
                sessionId: "session-1",
                question: "Do you like polls?",
                totalVotes: 5,
                options: [
                    { id: "opt-1", text: "Yes", voteCount: 4, order: 0 },
                    { id: "opt-2", text: "No", voteCount: 1, order: 1 },
                ],
            },
        ];
        organizerFindFirst.mockResolvedValue({ id: "org-1" });
        pollFindMany.mockResolvedValue(mockPolls);

        const req = { params: { sessionId: "session-1" }, userId: "host-1" } as unknown as Request;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

        await getSessionPollsController(req, res);

        expect(organizerFindFirst).toHaveBeenCalledWith({
            where: {
                userId: "host-1",
                inviteStatus: "ACCEPTED",
                quiz: { quizSessions: { some: { id: "session-1" } } },
            },
            select: { id: true },
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ polls: mockPolls });
        expect(pollFindMany).toHaveBeenCalledWith({
            where: { sessionId: "session-1" },
            include: { options: { orderBy: { order: "asc" } } },
            orderBy: { createdAt: "desc" },
        });
    });

    it("returns 400 when sessionId is missing", async () => {
        const req = { params: {}, userId: "host-1" } as unknown as Request;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

        await getSessionPollsController(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Session ID is required" });
        expect(organizerFindFirst).not.toHaveBeenCalled();
    });

    it("returns 401 when userId is missing", async () => {
        const req = { params: { sessionId: "session-1" } } as unknown as Request;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

        await getSessionPollsController(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: "You're not authorized..." });
        expect(organizerFindFirst).not.toHaveBeenCalled();
        expect(pollFindMany).not.toHaveBeenCalled();
    });

    it("returns 403 when caller is not an accepted organizer of the session", async () => {
        organizerFindFirst.mockResolvedValue(null);

        const req = { params: { sessionId: "session-1" }, userId: "other-user" } as unknown as Request;
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;

        await getSessionPollsController(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: "You don't have access to this session's polls",
        });
        expect(pollFindMany).not.toHaveBeenCalled();
    });

    it("enforces authMiddleware (401 without token, 403 for non-organizer, 200 for host) on GET /:sessionId/polls", async () => {
        const app = express();
        app.use("/api/v1/sessions", sessionRouter);

        const server = app.listen(0);
        try {
            const { port } = server.address() as AddressInfo;
            const baseUrl = `http://127.0.0.1:${port}/api/v1/sessions/session-1/polls`;

            // 1. No token -> 401
            const unauthResp = await fetch(baseUrl);
            expect(unauthResp.status).toBe(401);
            expect(organizerFindFirst).not.toHaveBeenCalled();

            // 2. Valid token for non-organizer -> 403
            organizerFindFirst.mockResolvedValueOnce(null);
            const otherToken = jwt.sign({ userId: "stranger-1" }, SECRET);
            const forbiddenResp = await fetch(baseUrl, {
                headers: { Authorization: `Bearer ${otherToken}` },
            });
            expect(forbiddenResp.status).toBe(403);
            expect(pollFindMany).not.toHaveBeenCalled();

            // 3. Valid token for accepted organizer -> 200
            const hostPolls = [{ id: "poll-1", sessionId: "session-1", question: "Q?", options: [] }];
            organizerFindFirst.mockResolvedValueOnce({ id: "org-1" });
            pollFindMany.mockResolvedValueOnce(hostPolls);
            const hostToken = jwt.sign({ userId: "host-1" }, SECRET);
            const okResp = await fetch(baseUrl, {
                headers: { Authorization: `Bearer ${hostToken}` },
            });
            expect(okResp.status).toBe(200);
            expect(await okResp.json()).toEqual({ polls: hostPolls });
        } finally {
            server.close();
        }
    });

    it("allows legitimate repeated organizer polling up to limit and returns 429 when exceeded", async () => {
        const app = express();
        app.use("/api/v1/sessions", sessionRouter);

        const hostToken = jwt.sign({ userId: "host-1" }, SECRET);
        const hostPolls = [{ id: "poll-1", sessionId: "session-1", question: "Q?", options: [] }];
        organizerFindFirst.mockResolvedValue({ id: "org-1" });
        pollFindMany.mockResolvedValue(hostPolls);

        const server = app.listen(0);
        try {
            const { port } = server.address() as AddressInfo;
            const baseUrl = `http://127.0.0.1:${port}/api/v1/sessions/session-1/polls`;

            for (let i = 0; i < SESSION_POLLS_RATE_LIMIT_MAX; i++) {
                const resp = await fetch(baseUrl, {
                    headers: { Authorization: `Bearer ${hostToken}` },
                });
                expect(resp.status).toBe(200);
                if (i === 0) {
                    expect(resp.headers.get("ratelimit")).toBeTruthy();
                }
            }
            expect(organizerFindFirst).toHaveBeenCalledTimes(SESSION_POLLS_RATE_LIMIT_MAX);
            expect(pollFindMany).toHaveBeenCalledTimes(SESSION_POLLS_RATE_LIMIT_MAX);

            const blockedResp = await fetch(baseUrl, {
                headers: { Authorization: `Bearer ${hostToken}` },
            });
            expect(blockedResp.status).toBe(429);
            expect(await blockedResp.json()).toEqual({
                success: false,
                error: "Too many requests, please try again later.",
            });
            expect(organizerFindFirst).toHaveBeenCalledTimes(SESSION_POLLS_RATE_LIMIT_MAX);
            expect(pollFindMany).toHaveBeenCalledTimes(SESSION_POLLS_RATE_LIMIT_MAX);
        } finally {
            server.close();
        }
    });

    it("throttles repeated unauthorized requests before authMiddleware and organizer queries", async () => {
        const app = express();
        app.use("/api/v1/sessions", sessionRouter);

        const server = app.listen(0);
        try {
            const { port } = server.address() as AddressInfo;
            const baseUrl = `http://127.0.0.1:${port}/api/v1/sessions/session-1/polls`;

            for (let i = 0; i < SESSION_POLLS_RATE_LIMIT_MAX; i++) {
                const resp = await fetch(baseUrl);
                expect(resp.status).toBe(401);
            }

            const throttledResp = await fetch(baseUrl);
            expect(throttledResp.status).toBe(429);
            expect(organizerFindFirst).not.toHaveBeenCalled();
            expect(pollFindMany).not.toHaveBeenCalled();
        } finally {
            server.close();
        }
    });
});

