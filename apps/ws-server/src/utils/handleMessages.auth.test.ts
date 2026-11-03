import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import WebSocket from "ws";

const mocks = vi.hoisted(() => ({
    prisma: {
        quizOrganizer: { findFirst: vi.fn() },
        quizSession: { updateMany: vi.fn(), update: vi.fn() },
        participant: { findUnique: vi.fn() },
    },
    broadcastToSession: vi.fn(),
    getCachedSession: vi.fn(),
    getCachedParticipants: vi.fn(),
    getCachedQuestions: vi.fn(),
    getCachedLeaderboard: vi.fn(),
    appendCachedParticipant: vi.fn(),
    invalidateSession: vi.fn(),
    invalidateLeaderboard: vi.fn(),
    clearSessionCache: vi.fn(),
    drainSession: vi.fn(),
    endQuizSession: vi.fn(),
    startQuestionTimer: vi.fn(),
    closeQuestionWindow: vi.fn(),
}));

vi.mock("@repo/db", () => ({ prisma: mocks.prisma }));
vi.mock("../redis.js", () => ({ cache: {} }));
vi.mock("./broadcastTosession.js", () => ({ broadcastToSession: mocks.broadcastToSession }));
vi.mock("./endQuizSession.js", () => ({ endQuizSession: mocks.endQuizSession }));
vi.mock("./leaderboard.js", () => ({ getLeaderboard: vi.fn() }));
vi.mock("./cache.js", () => ({
    getCachedSession: mocks.getCachedSession,
    getCachedQuestions: mocks.getCachedQuestions,
    getCachedParticipants: mocks.getCachedParticipants,
    getCachedLeaderboard: mocks.getCachedLeaderboard,
    invalidateParticipants: vi.fn(),
    appendCachedParticipant: mocks.appendCachedParticipant,
    invalidateLeaderboard: mocks.invalidateLeaderboard,
    invalidateSession: mocks.invalidateSession,
    clearSessionCache: mocks.clearSessionCache,
}));
vi.mock("./timeManager.js", () => ({
    startQuestionTimer: mocks.startQuestionTimer,
    timerDeadlineKey: (id: string) => `deadline:${id}`,
    currentQuestionKey: (id: string) => `current:${id}`,
    closeQuestionWindow: mocks.closeQuestionWindow,
    finishQuestionEarly: vi.fn(),
}));
vi.mock("./answerQueue.js", () => ({
    enqueueAnswer: vi.fn(),
    countAnswered: vi.fn(),
    drainSession: mocks.drainSession,
}));

import { handleMessage } from "./handleMessages.js";
import { clientsInSession } from "../clients/index.js";
import type { Client } from "../index.js";

const SECRET = "test-secret";
const hostToken = () => jwt.sign({ userId: "host-1" }, SECRET);

let nextSession = 0;
let sessionId: string;

function makeClient(overrides: Partial<Client> = {}): Client {
    return {
        ws: { readyState: WebSocket.OPEN, send: vi.fn(), terminate: vi.fn() } as unknown as WebSocket,
        sessionId: "",
        role: "PARTICIPANT",
        isAlive: true,
        ...overrides,
    };
}

function sent(client: Client) {
    return (client.ws.send as ReturnType<typeof vi.fn>).mock.calls.map(([raw]) => JSON.parse(raw));
}

function errorCodes(client: Client): string[] {
    return sent(client)
        .filter((message) => message.type === "error")
        .map((message) => message.payload.code);
}

/** A socket that has joined `sessionId` as a verified organizer. */
async function joinedHost(): Promise<Client> {
    mocks.prisma.quizOrganizer.findFirst.mockResolvedValue({ id: "org-1" });
    const host = makeClient();
    await handleMessage(host, {
        type: "join",
        payload: { sessionId, role: "ORGANIZER", token: hostToken() },
    });
    mocks.prisma.quizOrganizer.findFirst.mockClear();
    (host.ws.send as ReturnType<typeof vi.fn>).mockClear();
    return host;
}

/** A socket that has joined `sessionId` as a participant. */
async function joinedParticipant(): Promise<Client> {
    mocks.prisma.participant.findUnique.mockResolvedValue({ id: "p-1", username: "Sam" });
    mocks.appendCachedParticipant.mockResolvedValue([{ id: "p-1" }]);
    mocks.getCachedSession.mockResolvedValue({ status: "WAITING", quiz: { joinCode: "ABC123" } });
    const player = makeClient();
    await handleMessage(player, {
        type: "join",
        payload: { sessionId, role: "PARTICIPANT", participantId: "p-1" },
    });
    (player.ws.send as ReturnType<typeof vi.fn>).mockClear();
    mocks.broadcastToSession.mockClear();
    return player;
}

beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    sessionId = `session-${nextSession++}`;
    for (const mock of [
        mocks.prisma.quizOrganizer.findFirst,
        mocks.prisma.quizSession.updateMany,
        mocks.prisma.quizSession.update,
        mocks.prisma.participant.findUnique,
        mocks.broadcastToSession,
        mocks.getCachedSession,
        mocks.getCachedParticipants,
        mocks.getCachedQuestions,
        mocks.getCachedLeaderboard,
        mocks.appendCachedParticipant,
        mocks.invalidateSession,
        mocks.invalidateLeaderboard,
        mocks.clearSessionCache,
        mocks.drainSession,
        mocks.endQuizSession,
        mocks.startQuestionTimer,
        mocks.closeQuestionWindow,
    ]) {
        mock.mockReset();
    }
    mocks.getCachedParticipants.mockResolvedValue([]);
    mocks.getCachedSession.mockResolvedValue({ status: "WAITING", quiz: { joinCode: "ABC123" } });
    mocks.prisma.quizSession.updateMany.mockResolvedValue({ count: 1 });
});

describe("joining as an organizer", () => {
    it("makes a verified organizer the host and sends them the lobby", async () => {
        mocks.prisma.quizOrganizer.findFirst.mockResolvedValue({ id: "org-1" });
        const host = makeClient();

        await handleMessage(host, {
            type: "join",
            payload: { sessionId, role: "ORGANIZER", token: hostToken() },
        });

        expect(host.role).toBe("ORGANIZER");
        expect(host.sessionId).toBe(sessionId);
        expect(host.userId).toBe("host-1");
        expect(sent(host)[0]).toMatchObject({
            type: "participants:sync",
            payload: { joinCode: "ABC123" },
        });
        expect(clientsInSession(sessionId).has(host)).toBe(true);
    });

    it("checks the user against the quiz that owns the session", async () => {
        mocks.prisma.quizOrganizer.findFirst.mockResolvedValue({ id: "org-1" });

        await handleMessage(makeClient(), {
            type: "join",
            payload: { sessionId, role: "ORGANIZER", token: hostToken() },
        });

        expect(mocks.prisma.quizOrganizer.findFirst).toHaveBeenCalledWith({
            where: {
                userId: "host-1",
                inviteStatus: "ACCEPTED",
                quiz: { quizSessions: { some: { id: sessionId } } },
            },
            select: { id: true },
        });
    });

    it("refuses an organizer claim that has no token", async () => {
        const intruder = makeClient();

        await handleMessage(intruder, { type: "join", payload: { sessionId, role: "ORGANIZER" } });

        expect(errorCodes(intruder)).toEqual(["ORGANIZER_AUTH_FAILED"]);
        expect(intruder.role).toBe("PARTICIPANT");
        expect(intruder.sessionId).toBe("");
        expect(clientsInSession(sessionId).has(intruder)).toBe(false);
        expect(mocks.prisma.quizOrganizer.findFirst).not.toHaveBeenCalled();
        expect(sent(intruder).some((message) => message.type === "participants:sync")).toBe(false);
    });

    it("refuses a token signed with another secret", async () => {
        const intruder = makeClient();

        await handleMessage(intruder, {
            type: "join",
            payload: { sessionId, role: "ORGANIZER", token: jwt.sign({ userId: "host-1" }, "wrong") },
        });

        expect(errorCodes(intruder)).toEqual(["ORGANIZER_AUTH_FAILED"]);
        expect(intruder.role).toBe("PARTICIPANT");
        expect(mocks.prisma.quizOrganizer.findFirst).not.toHaveBeenCalled();
    });

    it("refuses a valid login that is not an organizer of this quiz", async () => {
        mocks.prisma.quizOrganizer.findFirst.mockResolvedValue(null);
        const other = makeClient();

        await handleMessage(other, {
            type: "join",
            payload: { sessionId, role: "ORGANIZER", token: jwt.sign({ userId: "someone-else" }, SECRET) },
        });

        expect(errorCodes(other)).toEqual(["ORGANIZER_AUTH_FAILED"]);
        expect(other.role).toBe("PARTICIPANT");
        expect(other.sessionId).toBe("");
        expect(clientsInSession(sessionId).has(other)).toBe(false);
    });

    it("refuses an organizer claim without a usable session id", async () => {
        const intruder = makeClient();

        await handleMessage(intruder, {
            type: "join",
            payload: { role: "ORGANIZER", token: hostToken() },
        });

        expect(errorCodes(intruder)).toEqual(["ORGANIZER_AUTH_FAILED"]);
        expect(mocks.prisma.quizOrganizer.findFirst).not.toHaveBeenCalled();
    });

    it("takes the user id from the token, not from the message", async () => {
        mocks.prisma.quizOrganizer.findFirst.mockResolvedValue({ id: "org-1" });
        const host = makeClient();

        await handleMessage(host, {
            type: "join",
            payload: { sessionId, role: "ORGANIZER", token: hostToken(), userId: "victim" },
        });

        expect(host.userId).toBe("host-1");
    });

    it("treats an unknown role as a participant", async () => {
        const player = makeClient();
        mocks.prisma.participant.findUnique.mockResolvedValue({ id: "p-1" });
        mocks.appendCachedParticipant.mockResolvedValue([]);

        await handleMessage(player, {
            type: "join",
            payload: { sessionId, role: "admin", participantId: "p-1", token: hostToken() },
        });

        expect(player.role).toBe("PARTICIPANT");
        expect(mocks.prisma.quizOrganizer.findFirst).not.toHaveBeenCalled();
    });
});

describe("a participant cannot run the quiz", () => {
    it.each([
        ["quiz:start"],
        ["quiz:next-question"],
        ["quiz:end"],
        ["participants:refresh"],
    ])("%s is refused", async (type) => {
        const player = await joinedParticipant();

        await handleMessage(player, { type, payload: { sessionId, questionIndex: 0 } });

        expect(errorCodes(player)).toEqual(["NOT_ORGANIZER"]);
        expect(mocks.prisma.quizSession.updateMany).not.toHaveBeenCalled();
        expect(mocks.prisma.quizSession.update).not.toHaveBeenCalled();
        expect(mocks.broadcastToSession).not.toHaveBeenCalled();
        expect(mocks.endQuizSession).not.toHaveBeenCalled();
        expect(mocks.drainSession).not.toHaveBeenCalled();
        expect(mocks.startQuestionTimer).not.toHaveBeenCalled();
    });

    it("a participant who claims the organizer role in a later message is still refused", async () => {
        const player = await joinedParticipant();

        await handleMessage(player, {
            type: "join",
            payload: { sessionId, role: "ORGANIZER", participantId: "p-1" },
        });
        await handleMessage(player, { type: "quiz:end", payload: { sessionId } });

        expect(player.role).toBe("PARTICIPANT");
        expect(errorCodes(player)).toEqual(["ORGANIZER_AUTH_FAILED", "NOT_ORGANIZER"]);
        expect(mocks.endQuizSession).not.toHaveBeenCalled();
    });

    it("a socket that never joined is refused", async () => {
        const stranger = makeClient();

        await handleMessage(stranger, { type: "quiz:end", payload: { sessionId } });
        await handleMessage(stranger, { type: "quiz:start", payload: { sessionId } });

        expect(errorCodes(stranger)).toEqual(["NOT_ORGANIZER", "NOT_ORGANIZER"]);
        expect(mocks.endQuizSession).not.toHaveBeenCalled();
        expect(mocks.prisma.quizSession.updateMany).not.toHaveBeenCalled();
    });

    it("cannot read the lobby or the join code with participants:refresh", async () => {
        const stranger = makeClient();

        await handleMessage(stranger, { type: "participants:refresh", payload: { sessionId } });

        expect(sent(stranger).some((message) => message.type === "participants:sync")).toBe(false);
        expect(mocks.getCachedSession).not.toHaveBeenCalled();
    });
});

describe("a verified organizer can run their quiz", () => {
    it("starts the quiz", async () => {
        const host = await joinedHost();

        await handleMessage(host, { type: "quiz:start", payload: { sessionId } });

        expect(mocks.prisma.quizSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ id: sessionId }) }),
        );
        expect(mocks.broadcastToSession).toHaveBeenCalledWith(sessionId, "quiz:start");
        expect(errorCodes(host)).toEqual([]);
    });

    it("uses the joined session when the message leaves it out", async () => {
        const host = await joinedHost();

        await handleMessage(host, { type: "quiz:start", payload: {} });

        expect(mocks.prisma.quizSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ id: sessionId }) }),
        );
    });

    it("cannot act on a different session than the one they joined", async () => {
        const host = await joinedHost();

        await handleMessage(host, { type: "quiz:end", payload: { sessionId: "someone-elses-session" } });
        await handleMessage(host, { type: "quiz:start", payload: { sessionId: "someone-elses-session" } });

        expect(errorCodes(host)).toEqual(["SESSION_MISMATCH", "SESSION_MISMATCH"]);
        expect(mocks.endQuizSession).not.toHaveBeenCalled();
        expect(mocks.prisma.quizSession.updateMany).not.toHaveBeenCalled();
    });

    it("moves to the next question", async () => {
        const host = await joinedHost();
        mocks.getCachedQuestions.mockResolvedValue([
            { id: "q1", text: "Q?", answers: [{ id: "a1", text: "A", isCorrect: true }] },
        ]);

        await handleMessage(host, {
            type: "quiz:next-question",
            payload: { sessionId, questionIndex: 0 },
        });

        expect(mocks.prisma.quizSession.update).toHaveBeenCalledWith({
            where: { id: sessionId },
            data: { currentQuestionIndex: 0 },
        });
        expect(mocks.broadcastToSession).toHaveBeenCalledWith(
            sessionId,
            "quiz:question",
            expect.objectContaining({ question: expect.objectContaining({ id: "q1" }) }),
        );
        expect(mocks.startQuestionTimer).toHaveBeenCalledWith(sessionId, 0);
    });

    it("ends the quiz and shows the leaderboard", async () => {
        const host = await joinedHost();
        mocks.getCachedLeaderboard.mockResolvedValue([{ id: "p-1", score: 10 }]);

        await handleMessage(host, { type: "quiz:end", payload: { sessionId } });

        // answers stop being accepted before the buffer is drained
        expect(mocks.closeQuestionWindow).toHaveBeenCalledWith(sessionId);
        expect(mocks.closeQuestionWindow.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.drainSession.mock.invocationCallOrder[0],
        );
        expect(mocks.drainSession).toHaveBeenCalledWith(sessionId);
        expect(mocks.endQuizSession).toHaveBeenCalledWith(sessionId);
        expect(mocks.broadcastToSession).toHaveBeenCalledWith(sessionId, "quiz:leaderboard", {
            leaderboard: [{ id: "p-1", score: 10 }],
        });
        expect(mocks.broadcastToSession).toHaveBeenCalledWith(sessionId, "quiz:ended");
    });

    it("can refresh the lobby", async () => {
        const host = await joinedHost();
        mocks.getCachedParticipants.mockResolvedValue([{ id: "p-1" }]);

        await handleMessage(host, { type: "participants:refresh", payload: { sessionId } });

        expect(sent(host)).toEqual([
            {
                type: "participants:sync",
                payload: { participants: [{ id: "p-1" }], joinCode: "ABC123", liveVideo: false },
            },
        ]);
    });
});
