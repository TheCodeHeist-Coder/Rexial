import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * "Host Live" while a session of the quiz is already being played. Opening a
 * second lobby then leaves the players behind and sends new ones elsewhere.
 */

type Session = {
    id: string;
    quizId: string;
    status: string;
    liveVideo: boolean;
    createdAt: number;
    endedAt?: Date;
};

const db = vi.hoisted(() => ({
    sessions: [] as any[],
    players: new Map<string, number>(),
}));

vi.mock("@repo/db", () => {
    const matches = (session: any, where: any = {}) =>
        Object.entries(where).every(([key, wanted]: [string, any]) =>
            wanted?.in ? wanted.in.includes(session[key]) : session[key] === wanted);
    const newestFirst = (where: any) =>
        db.sessions.filter((s) => matches(s, where)).sort((a, b) => b.createdAt - a.createdAt);

    const quizSession = {
        findFirst: async ({ where }: any) => newestFirst(where)[0] ?? null,
        create: async ({ data }: any) => {
            const session = {
                id: `new-${db.sessions.length}`,
                liveVideo: false,
                createdAt: db.sessions.length + 100,
                ...data,
            };
            db.sessions.push(session);
            return session;
        },
        update: async ({ where, data }: any) =>
            Object.assign(db.sessions.find((s) => s.id === where.id), data),
        updateMany: async ({ where, data }: any) => {
            const found = newestFirst(where);
            found.forEach((s) => Object.assign(s, data));
            return { count: found.length };
        },
    };
    const participant = {
        count: async ({ where }: any) => db.players.get(where.sessionId) ?? 0,
        create: async ({ data }: any) => ({ id: "late-player", ...data }),
    };

    return {
        prisma: {
            quizOrganizer: { findFirst: async () => ({ id: "organizer" }) },
            quiz: {
                findUnique: async ({ include }: any) => ({
                    id: "quiz-1",
                    title: "Quiz",
                    status: "ACTIVE",
                    quizSessions: newestFirst({
                        quizId: "quiz-1",
                        ...include.quizSessions.where,
                    }).slice(0, 1),
                }),
            },
            quizSession,
            participant,
            $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
                fn({ quizSession, participant }),
        },
    };
});

const { startQuizSessionController } = await import("./quizController");
const { joinQuizController } = await import("./sessionController");

const call = async (controller: typeof startQuizSessionController, req: object) => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await controller(req as unknown as Request, res as unknown as Response);
    return { status: res.status.mock.calls[0]![0], body: res.json.mock.calls[0]![0] };
};

const hostLive = (body: object = {}) =>
    call(startQuizSessionController, { userId: "user-1", params: { quizId: "quiz-1" }, body });

const join = () => call(joinQuizController, { body: { code: "ABC123", username: "Late" } });

const seed = (id: string, status: string, createdAt: number, liveVideo = false): Session => {
    const session = { id, quizId: "quiz-1", status, liveVideo, createdAt };
    db.sessions.push(session);
    return session;
};

const statuses = () => db.sessions.map((s) => `${s.id} ${s.status}`);

beforeEach(() => {
    db.sessions.length = 0;
    db.players.clear();
});

describe("startQuizSessionController with a session in progress", () => {
    it("returns the running session and opens nothing", async () => {
        seed("running", "IN_PROGRESS", 1);

        const { status, body } = await hostLive();

        expect(status).toBe(200);
        expect(body).toEqual({ sessonId: "running", liveVideo: false, inProgress: true });
        expect(statuses()).toEqual(["running IN_PROGRESS"]);
    });

    it("keeps late joiners in the running session", async () => {
        seed("running", "IN_PROGRESS", 1);
        await hostLive();

        const { body } = await join();

        expect(body.sessionId).toBe("running");
    });

    it("reports the running session even if a newer lobby is also open", async () => {
        seed("running", "IN_PROGRESS", 1);
        seed("lobby", "WAITING", 2);

        const { body } = await hostLive();

        expect(body).toMatchObject({ sessonId: "running", inProgress: true });
    });

    it("does not change a running session to the other video mode", async () => {
        seed("running", "IN_PROGRESS", 1);

        const { body } = await hostLive({ liveVideo: true });

        expect(body).toEqual({ sessonId: "running", liveVideo: false, inProgress: true });
        expect(statuses()).toEqual(["running IN_PROGRESS"]);
    });

    it("cancels it and opens a new lobby when asked to restart", async () => {
        const running = seed("running", "IN_PROGRESS", 1);

        const { body } = await hostLive({ restart: true });

        expect(body).toEqual({ sessonId: "new-1", liveVideo: false });
        expect(statuses()).toEqual(["running CANCELLED", "new-1 WAITING"]);
        expect(running.endedAt).toBeInstanceOf(Date);
        expect((await join()).body.sessionId).toBe("new-1");
    });

    it("cancels every unfinished run and reuses an open lobby on restart", async () => {
        seed("old", "IN_PROGRESS", 1);
        seed("running", "IN_PROGRESS", 2);
        seed("lobby", "WAITING", 3);

        const { body } = await hostLive({ restart: true });

        expect(body.sessonId).toBe("lobby");
        expect(statuses()).toEqual(["old CANCELLED", "running CANCELLED", "lobby WAITING"]);
    });

    it("leaves it running when the restart is refused", async () => {
        seed("running", "IN_PROGRESS", 1);
        seed("lobby", "WAITING", 2, true);
        db.players.set("lobby", 3);

        const { status } = await hostLive({ restart: true });

        expect(status).toBe(409);
        expect(statuses()).toEqual(["running IN_PROGRESS", "lobby WAITING"]);
    });
});

describe("startQuizSessionController with nothing in progress", () => {
    it("opens a lobby, ignoring finished sessions", async () => {
        seed("done", "COMPLETED", 1);
        seed("cancelled", "CANCELLED", 2);

        const { body } = await hostLive();

        expect(body).toEqual({ sessonId: "new-2", liveVideo: false });
    });

    it("reuses the open lobby", async () => {
        seed("lobby", "WAITING", 1);

        const { body } = await hostLive();

        expect(body).toEqual({ sessonId: "lobby", liveVideo: false });
        expect(statuses()).toEqual(["lobby WAITING"]);
    });
});
