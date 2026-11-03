import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

const mocks = vi.hoisted(() => ({
    cache: { get: vi.fn() },
    getCachedQuestions: vi.fn(),
    enqueueAnswer: vi.fn(),
    countAnswered: vi.fn(),
    finishQuestionEarly: vi.fn(),
    closeQuestionWindow: vi.fn(),
    drainSession: vi.fn(),
    broadcastToSession: vi.fn(),
}));

vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("../redis.js", () => ({ cache: mocks.cache }));
vi.mock("./broadcastTosession.js", () => ({ broadcastToSession: mocks.broadcastToSession }));
vi.mock("./endQuizSession.js", () => ({ endQuizSession: vi.fn() }));
vi.mock("./leaderboard.js", () => ({ getLeaderboard: vi.fn() }));
vi.mock("./cache.js", () => ({
    getCachedSession: vi.fn(),
    getCachedQuestions: mocks.getCachedQuestions,
    getCachedParticipants: vi.fn(),
    getCachedLeaderboard: vi.fn().mockResolvedValue([]),
    invalidateParticipants: vi.fn(),
    appendCachedParticipant: vi.fn(),
    invalidateLeaderboard: vi.fn(),
    invalidateSession: vi.fn(),
    clearSessionCache: vi.fn(),
}));
vi.mock("./timeManager.js", () => ({
    startQuestionTimer: vi.fn(),
    timerDeadlineKey: (id: string) => `deadline:${id}`,
    currentQuestionKey: (id: string) => `current:${id}`,
    closeQuestionWindow: mocks.closeQuestionWindow,
    finishQuestionEarly: mocks.finishQuestionEarly,
}));
vi.mock("./answerQueue.js", () => ({
    enqueueAnswer: mocks.enqueueAnswer,
    countAnswered: mocks.countAnswered,
    drainSession: mocks.drainSession,
}));

import { handleMessage } from "./handleMessages.js";
import type { Client } from "../index.js";

const SESSION = "s-1";
const START = new Date("2026-01-01T00:00:00Z").getTime();
const LIMIT_S = 20;

const questions = [
    {
        id: "q1",
        timeLimit: LIMIT_S,
        answers: [
            { id: "right", isCorrect: true },
            { id: "wrong", isCorrect: false },
        ],
    },
    {
        id: "q2",
        timeLimit: LIMIT_S,
        answers: [{ id: "right2", isCorrect: true }],
    },
];

/** What the timer leaves in Redis while a question is open. */
function openQuestion(index: number, startedAt = START) {
    const redis: Record<string, string> = {
        [`deadline:${SESSION}`]: String(startedAt + LIMIT_S * 1_000),
        [`current:${SESSION}`]: String(index),
    };
    mocks.cache.get.mockImplementation(async (key: string) => redis[key] ?? null);
}

function player(): Client {
    return {
        ws: { readyState: WebSocket.OPEN, send: vi.fn(), terminate: vi.fn() } as unknown as WebSocket,
        sessionId: SESSION,
        role: "PARTICIPANT",
        participantId: "p-1",
        isAlive: true,
    } as Client;
}

function submit(overrides: Record<string, unknown> = {}) {
    return handleMessage(player(), {
        type: "quiz:submit-answer",
        payload: {
            sessionId: SESSION,
            participantId: "p-1",
            questionId: "q1",
            answerId: "right",
            timeMs: 0,
            ...overrides,
        },
    });
}

function enqueued() {
    return mocks.enqueueAnswer.mock.calls.map(([, answer]) => answer);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    for (const mock of [
        mocks.cache.get,
        mocks.getCachedQuestions,
        mocks.enqueueAnswer,
        mocks.countAnswered,
        mocks.finishQuestionEarly,
    ]) {
        mock.mockReset();
    }
    mocks.getCachedQuestions.mockResolvedValue(questions);
    mocks.enqueueAnswer.mockReturnValue(true);
    mocks.countAnswered.mockResolvedValue(0);
});

afterEach(() => {
    vi.useRealTimers();
});

describe("quiz:submit-answer timing", () => {
    it("ignores a client timeMs of 0 and scores from the server clock", async () => {
        openQuestion(0);
        vi.setSystemTime(START + 15_000); // 15s of 20s used

        await submit({ timeMs: 0 });

        expect(enqueued()).toEqual([
            expect.objectContaining({ timeMs: 15_000, points: 3, isCorrect: true }),
        ]);
    });

    it("gives the same score whatever timeMs the client claims", async () => {
        openQuestion(0);
        vi.setSystemTime(START + 5_000);

        await submit({ timeMs: 0 });
        await submit({ timeMs: 19_999 });
        await submit({ timeMs: -500 });
        await submit({ timeMs: "nope" });

        expect(enqueued().map((a) => [a.timeMs, a.points])).toEqual([
            [5_000, 8],
            [5_000, 8],
            [5_000, 8],
            [5_000, 8],
        ]);
    });

    it("still pays the maximum for an answer the instant the question opens", async () => {
        openQuestion(0);

        await submit();

        expect(enqueued()).toEqual([expect.objectContaining({ timeMs: 0, points: 10 })]);
    });

    it("scores a wrong answer 0", async () => {
        openQuestion(0);
        vi.setSystemTime(START + 1_000);

        await submit({ answerId: "wrong" });

        expect(enqueued()).toEqual([expect.objectContaining({ isCorrect: false, points: 0 })]);
    });

    it("accepts an answer right on the deadline and floors it at 1 point", async () => {
        openQuestion(0);
        vi.setSystemTime(START + LIMIT_S * 1_000);

        await submit();

        expect(enqueued()).toEqual([expect.objectContaining({ timeMs: 20_000, points: 1 })]);
    });
});

describe("quiz:submit-answer is only accepted for the live question", () => {
    it("rejects an answer after the deadline", async () => {
        openQuestion(0);
        vi.setSystemTime(START + LIMIT_S * 1_000 + 1);

        await submit();

        expect(mocks.enqueueAnswer).not.toHaveBeenCalled();
    });

    it("rejects an answer once the question is closed (deadline key gone)", async () => {
        mocks.cache.get.mockResolvedValue(null);

        await submit();

        expect(mocks.enqueueAnswer).not.toHaveBeenCalled();
        expect(mocks.finishQuestionEarly).not.toHaveBeenCalled();
    });

    it("rejects an answer for a question that is not the current one", async () => {
        openQuestion(1);

        await submit({ questionId: "q1" });

        expect(mocks.enqueueAnswer).not.toHaveBeenCalled();
    });

    it("accepts the question that is current", async () => {
        openQuestion(1);

        await submit({ questionId: "q2", answerId: "right2" });

        expect(enqueued()).toEqual([expect.objectContaining({ questionId: "q2" })]);
    });

    it("rejects a question id that does not exist", async () => {
        openQuestion(0);

        await submit({ questionId: "made-up" });

        expect(mocks.enqueueAnswer).not.toHaveBeenCalled();
    });

    it("rejects when the current-question marker is missing", async () => {
        const redis: Record<string, string> = {
            [`deadline:${SESSION}`]: String(START + 10_000),
        };
        mocks.cache.get.mockImplementation(async (key: string) => redis[key] ?? null);

        await submit();

        expect(mocks.enqueueAnswer).not.toHaveBeenCalled();
    });

    it("rejects a garbage deadline value", async () => {
        const redis: Record<string, string> = {
            [`deadline:${SESSION}`]: "not-a-number",
            [`current:${SESSION}`]: "0",
        };
        mocks.cache.get.mockImplementation(async (key: string) => redis[key] ?? null);

        await submit();

        expect(mocks.enqueueAnswer).not.toHaveBeenCalled();
    });

    it("still ignores a message with no participant id", async () => {
        openQuestion(0);

        await submit({ participantId: undefined });

        expect(mocks.enqueueAnswer).not.toHaveBeenCalled();
    });
});
