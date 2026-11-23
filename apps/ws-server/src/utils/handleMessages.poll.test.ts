import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import WebSocket from "ws";

const mocks = vi.hoisted(() => ({
    prisma: {
        quizOrganizer: { findFirst: vi.fn() },
        quizSession: { updateMany: vi.fn(), update: vi.fn() },
        participant: { findUnique: vi.fn() },
        poll: { upsert: vi.fn(), create: vi.fn(), findMany: vi.fn() },
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
import { clearSessionPolls } from "./pollManager.js";
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

function broadcasts() {
    return mocks.broadcastToSession.mock.calls.map(([sid, type, payload]) => ({ sid, type, payload }));
}

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

async function joinedParticipant(participantId = "p-1"): Promise<Client> {
    mocks.prisma.participant.findUnique.mockResolvedValue({ id: participantId, username: "Player" });
    const p = makeClient({ participantId });
    await handleMessage(p, {
        type: "join",
        payload: { sessionId, role: "PARTICIPANT", participantId },
    });
    mocks.prisma.participant.findUnique.mockClear();
    (p.ws.send as ReturnType<typeof vi.fn>).mockClear();
    return p;
}

describe("Live polling feature", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionId = `sess-poll-${++nextSession}`;
        clearSessionPolls(sessionId);
        process.env.JWT_SECRET = SECRET;
    });

    it("allows organizer to create a poll and broadcasts poll:started", async () => {
        const host = await joinedHost();

        await handleMessage(host, {
            type: "poll:create",
            payload: {
                sessionId,
                token: hostToken(),
                question: "Is this question too hard?",
                options: ["Yes, very", "Just right", "Too easy"],
                questionIndex: 2,
            },
        });

        const startEvents = broadcasts().filter(b => b.type === "poll:started");
        expect(startEvents.length).toBe(1);
        expect(startEvents[0]?.payload.poll).toMatchObject({
            question: "Is this question too hard?",
            status: "ACTIVE",
            totalVotes: 0,
            questionIndex: 2,
        });
        expect(startEvents[0]?.payload.poll.options).toHaveLength(3);
        expect(startEvents[0]?.payload.poll.options[0].text).toBe("Yes, very");
    });

    it("rejects poll:create from a regular participant", async () => {
        const p = await joinedParticipant();

        await handleMessage(p, {
            type: "poll:create",
            payload: {
                sessionId,
                question: "Unauthorized poll",
                options: ["A", "B"],
            },
        });

        const startEvents = broadcasts().filter(b => b.type === "poll:started");
        expect(startEvents.length).toBe(0);
        const errors = sent(p).filter(m => m.type === "error");
        expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects poll with empty question or fewer than 2 options", async () => {
        const host = await joinedHost();

        await handleMessage(host, {
            type: "poll:create",
            payload: {
                sessionId,
                token: hostToken(),
                question: "",
                options: ["Option 1"],
            },
        });

        const startEvents = broadcasts().filter(b => b.type === "poll:started");
        expect(startEvents.length).toBe(0);
        const errors = sent(host).filter(m => m.type === "error");
        expect(errors[0]?.payload.code).toBe("INVALID_POLL");
    });

    it("allows participant to vote and updates percentages in real-time", async () => {
        const host = await joinedHost();
        const p1 = await joinedParticipant("p-1");
        const p2 = await joinedParticipant("p-2");

        await handleMessage(host, {
            type: "poll:create",
            payload: {
                sessionId,
                token: hostToken(),
                question: "Vote?",
                options: ["Option A", "Option B"],
            },
        });

        const pollStarted = broadcasts().find(b => b.type === "poll:started")?.payload.poll;
        const optA = pollStarted.options[0].id;
        const optB = pollStarted.options[1].id;

        // p1 votes for A
        await handleMessage(p1, {
            type: "poll:vote",
            payload: {
                sessionId,
                pollId: pollStarted.id,
                optionId: optA,
                participantId: "p-1",
            },
        });

        const updateEvents1 = broadcasts().filter(b => b.type === "poll:updated");
        expect(updateEvents1.length).toBe(1);
        const poll1 = updateEvents1[0]?.payload.poll;
        expect(poll1.totalVotes).toBe(1);
        expect(poll1.options.find((o: any) => o.id === optA).voteCount).toBe(1);
        expect(poll1.options.find((o: any) => o.id === optA).percentage).toBe(100);

        // p2 votes for B
        await handleMessage(p2, {
            type: "poll:vote",
            payload: {
                sessionId,
                pollId: pollStarted.id,
                optionId: optB,
                participantId: "p-2",
            },
        });

        const updateEvents2 = broadcasts().filter(b => b.type === "poll:updated");
        expect(updateEvents2.length).toBe(2);
        const poll2 = updateEvents2[1]?.payload.poll;
        expect(poll2.totalVotes).toBe(2);
        expect(poll2.options.find((o: any) => o.id === optA).percentage).toBe(50);
        expect(poll2.options.find((o: any) => o.id === optB).percentage).toBe(50);
    });

    it("prevents double voting from the same participant", async () => {
        const host = await joinedHost();
        const p1 = await joinedParticipant("p-1");

        await handleMessage(host, {
            type: "poll:create",
            payload: {
                sessionId,
                token: hostToken(),
                question: "Vote?",
                options: ["Option A", "Option B"],
            },
        });

        const pollStarted = broadcasts().find(b => b.type === "poll:started")?.payload.poll;
        const optA = pollStarted.options[0].id;
        const optB = pollStarted.options[1].id;

        // First vote succeeds
        await handleMessage(p1, {
            type: "poll:vote",
            payload: {
                sessionId,
                pollId: pollStarted.id,
                optionId: optA,
                participantId: "p-1",
            },
        });

        // Second vote should fail
        await handleMessage(p1, {
            type: "poll:vote",
            payload: {
                sessionId,
                pollId: pollStarted.id,
                optionId: optB,
                participantId: "p-1",
            },
        });

        const errors = sent(p1).filter(m => m.type === "error");
        expect(errors[0]?.payload.code).toBe("ALREADY_VOTED");
    });

    it("allows organizer to end the poll and locks results", async () => {
        const host = await joinedHost();
        const p1 = await joinedParticipant("p-1");

        await handleMessage(host, {
            type: "poll:create",
            payload: {
                sessionId,
                token: hostToken(),
                question: "Vote?",
                options: ["A", "B"],
            },
        });

        const pollStarted = broadcasts().find(b => b.type === "poll:started")?.payload.poll;

        await handleMessage(host, {
            type: "poll:end",
            payload: {
                sessionId,
                token: hostToken(),
                pollId: pollStarted.id,
            },
        });

        const endEvents = broadcasts().filter(b => b.type === "poll:ended");
        expect(endEvents.length).toBe(1);
        expect(endEvents[0]?.payload.poll.status).toBe("ENDED");

        // Voting after end is rejected
        await handleMessage(p1, {
            type: "poll:vote",
            payload: {
                sessionId,
                pollId: pollStarted.id,
                optionId: pollStarted.options[0].id,
                participantId: "p-1",
            },
        });

        const errors = sent(p1).filter(m => m.type === "error");
        expect(errors[0]?.payload.code).toBe("POLL_INACTIVE");
    });

    it("allows organizer to record the poll result at the moment", async () => {
        const host = await joinedHost();
        mocks.prisma.poll.upsert.mockResolvedValue({ id: "saved-1" });

        await handleMessage(host, {
            type: "poll:create",
            payload: {
                sessionId,
                token: hostToken(),
                question: "Important Poll",
                options: ["Yes", "No"],
            },
        });

        const pollStarted = broadcasts().find(b => b.type === "poll:started")?.payload.poll;

        await handleMessage(host, {
            type: "poll:record",
            payload: {
                sessionId,
                token: hostToken(),
                pollId: pollStarted.id,
            },
        });

        const recordEvents = broadcasts().filter(b => b.type === "poll:recorded");
        expect(recordEvents.length).toBe(1);
        expect(recordEvents[0]?.payload.pollId).toBe(pollStarted.id);
        expect(recordEvents[0]?.payload.poll.isRecorded).toBe(true);
        expect(mocks.prisma.poll.upsert).toHaveBeenCalled();
    });

    it("allows organizer to dismiss poll and get recorded polls", async () => {
        const host = await joinedHost();
        mocks.prisma.poll.upsert.mockResolvedValue({ id: "saved-1" });

        await handleMessage(host, {
            type: "poll:create",
            payload: {
                sessionId,
                token: hostToken(),
                question: "Dismiss me later",
                options: ["A", "B"],
            },
        });

        const pollStarted = broadcasts().find(b => b.type === "poll:started")?.payload.poll;

        // Record it
        await handleMessage(host, {
            type: "poll:record",
            payload: {
                sessionId,
                token: hostToken(),
                pollId: pollStarted.id,
            },
        });

        // Get recorded
        await handleMessage(host, {
            type: "poll:get-recorded",
            payload: {
                sessionId,
                token: hostToken(),
            },
        });

        const listMessage = sent(host).find(m => m.type === "poll:recorded-list");
        expect(listMessage?.payload.polls.length).toBe(1);

        // Dismiss it
        await handleMessage(host, {
            type: "poll:dismiss",
            payload: {
                sessionId,
                token: hostToken(),
                pollId: pollStarted.id,
            },
        });

        const dismissEvents = broadcasts().filter(b => b.type === "poll:dismissed");
        expect(dismissEvents.length).toBe(1);
    });
});
