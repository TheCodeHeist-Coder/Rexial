import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

// Delayed work left over from one question must not affect the next. These run
// the real message handler and timers; only Redis and Postgres are faked.
const mocks = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock("../redis.js", () => ({
    cache: {
        get: async (key: string) => mocks.store.get(key) ?? null,
        set: async (key: string, value: string, ...args: unknown[]) => {
            if (args.includes("NX") && mocks.store.has(key)) return null;
            mocks.store.set(key, value);
            return "OK";
        },
        setex: async (key: string, _ttl: number, value: string) => {
            mocks.store.set(key, value);
            return "OK";
        },
        del: async (...keys: string[]) => keys.filter((key) => mocks.store.delete(key)).length,
    },
    pub: { publish: async () => 1 },
    sub: {},
    sessionChannel: (id: string) => `session:${id}`,
}));

vi.mock("@repo/db", () => {
    const questions = [0, 1].map((i) => ({
        id: `q${i}`,
        text: `Q${i}`,
        timeLimit: 10,
        answers: [{ id: `a${i}`, text: "A", isCorrect: true }],
    }));
    return {
        getRankedParticipants: async () => [{ id: "p-1", score: 10 }],
        prisma: {
            quizSession: {
                update: async () => ({}),
                findUnique: async () => ({ quiz: { questions } }),
            },
            participantAnswer: { createManyAndReturn: async () => [] },
            $transaction: async () => undefined,
        },
    };
});

import { handleMessage } from "./handleMessages.js";
import { clients, indexClient } from "../clients/index.js";
import type { Client } from "../index.js";

let nextSession = 0;
let sessionId: string;
let host: ReturnType<typeof join>;
let player: ReturnType<typeof join>;

function join(role: Client["role"], participantId?: string) {
    const received: { type: string; payload: any }[] = [];
    const client = {
        ws: { readyState: WebSocket.OPEN, send: (m: string) => received.push(JSON.parse(m)) },
        sessionId: "",
        role,
        participantId,
        isAlive: true,
    } as unknown as Client;
    clients.add(client);
    indexClient(client, sessionId);
    client.sessionId = sessionId;
    return { client, received };
}

const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);

const ask = (questionIndex: number) =>
    handleMessage(host.client, { type: "quiz:next-question", payload: { sessionId, questionIndex } });

const answer = (questionIndex: number) =>
    handleMessage(player.client, {
        type: "quiz:submit-answer",
        payload: {
            sessionId,
            participantId: "p-1",
            questionId: `q${questionIndex}`,
            answerId: `a${questionIndex}`,
        },
    });

const showStandings = () =>
    handleMessage(host.client, { type: "quiz:show-leaderboard", payload: { sessionId } });

/** What the player was told, in order, leaving out the ticking and the tally. */
const events = () =>
    player.received
        .filter((m) => m.type !== "quiz:timer-tick" && m.type !== "quiz:answer-progress")
        .map((m) => (m.type === "quiz:question" ? `${m.type} ${m.payload.question.id}` : m.type));

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "log").mockImplementation(() => {});
    mocks.store.clear();
    clients.clear();
    sessionId = `timers-${++nextSession}`;
    host = join("ORGANIZER");
    player = join("PARTICIPANT", "p-1");
});

afterEach(async () => {
    // Let any countdown still running finish before the next test.
    await wait(30_000);
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("after a question closes", () => {
    it("sends the standings two seconds after the results", async () => {
        await ask(0);
        await wait(10_000);
        expect(events()).toEqual(["quiz:question q0", "quiz:question-results"]);

        await wait(2_000);

        expect(events()).toEqual(["quiz:question q0", "quiz:question-results", "quiz:leaderboard"]);
    });

    it("drops standings still waiting when the next question starts", async () => {
        await ask(0);
        await wait(10_000);
        await wait(500);

        await ask(1);
        await wait(2_000);

        expect(events()).toEqual([
            "quiz:question q0",
            "quiz:question-results",
            "quiz:question q1",
        ]);
    });

    it("keeps the next question open when an early finish fires late", async () => {
        await ask(0);
        await wait(9_200);
        await answer(0); // everyone is in, so an early finish is due at 10.7s
        await wait(900); // the countdown closes the question first
        await ask(1);

        await wait(700);
        player.received.length = 0;
        await answer(1);

        expect(player.received).toContainEqual(
            expect.objectContaining({
                type: "quiz:answer-progress",
                payload: expect.objectContaining({ questionId: "q1", answered: 1 }),
            }),
        );
    });
});

describe("quiz:show-leaderboard", () => {
    it("sends the standings at once and stays on the same question", async () => {
        await ask(0);
        await wait(10_000);

        await showStandings();

        expect(events()).toEqual(["quiz:question q0", "quiz:question-results", "quiz:leaderboard"]);
        expect(player.received.at(-1)!.payload).toEqual({
            leaderboard: [{ id: "p-1", score: 10 }],
        });
    });

    it("works after the standings have already gone out, as after a host reload", async () => {
        await ask(0);
        await wait(60_000);
        player.received.length = 0;

        await showStandings();

        expect(events()).toEqual(["quiz:leaderboard"]);
    });

    it("sends nothing while a question is still open", async () => {
        await ask(0);
        await wait(3_000);

        await showStandings();

        expect(events()).toEqual(["quiz:question q0"]);
    });
});
