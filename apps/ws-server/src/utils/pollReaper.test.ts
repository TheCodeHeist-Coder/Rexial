import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

const mocks = vi.hoisted(() => ({
    findMany: vi.fn(),
    pollCreate: vi.fn(),
    pollUpdate: vi.fn(),
}));

vi.mock("@repo/db", () => ({
    prisma: {
        quizSession: { findMany: mocks.findMany },
        poll: { create: mocks.pollCreate, update: mocks.pollUpdate },
    },
}));

import { indexClient, unindexClient } from "../clients/index.js";
import type { Client } from "../index.js";
import {
    clearSessionPolls,
    createPoll,
    getActivePoll,
    getRecordedPolls,
    listTrackedPollSessionIds,
    recordPoll,
} from "./pollManager.js";
import {
    EMPTY_SESSION_GRACE_MS,
    ORPHANED_HOST_GRACE_MS,
    markSessionDisconnected,
    reapAbandonedPolls,
} from "./pollReaper.js";

const T0 = Date.parse("2026-11-26T10:00:00Z");

let nextId = 0;
let sessionId: string;
const trackedClients: Client[] = [];

function connectClient(sid: string, role: Client["role"], participantId?: string): Client {
    const client: Client = {
        ws: { readyState: WebSocket.OPEN, send: vi.fn(), terminate: vi.fn() } as unknown as WebSocket,
        sessionId: sid,
        role,
        participantId,
        isAlive: true,
    };
    indexClient(client, sid);
    trackedClients.push(client);
    return client;
}

describe("pollReaper", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        mocks.pollCreate.mockResolvedValue({ id: "saved" });
        mocks.pollUpdate.mockResolvedValue({ id: "saved" });
        sessionId = `sess-reap-${++nextId}`;
        await clearSessionPolls(sessionId);
    });

    afterEach(async () => {
        for (const c of trackedClients.splice(0)) {
            unindexClient(c);
        }
        await clearSessionPolls(sessionId);
    });

    it("does not query Postgres when no poll state is tracked", async () => {
        await reapAbandonedPolls(T0);
        expect(mocks.findMany).not.toHaveBeenCalled();
    });

    it.each(["COMPLETED", "CANCELLED", null])(
        "clears active polls, timers, and recorded cache immediately when session is %s",
        async (dbStatus) => {
            const poll = await createPoll(sessionId, "Will clean?", ["Yes", "No"], 0, 60);
            if (!poll) throw new Error("Expected first poll to start");
            await recordPoll(sessionId, poll.id);
            expect(getActivePoll(sessionId)).not.toBeNull();
            expect(getRecordedPolls(sessionId)).toHaveLength(1);

            mocks.findMany.mockResolvedValue(dbStatus ? [{ id: sessionId, status: dbStatus }] : []);

            await reapAbandonedPolls(T0);

            expect(getActivePoll(sessionId)).toBeNull();
            expect(getRecordedPolls(sessionId)).toEqual([]);
            expect(listTrackedPollSessionIds()).not.toContain(sessionId);
        },
    );

    it("keeps polls alive while an organizer socket is connected", async () => {
        await createPoll(sessionId, "Live host?", ["Yes", "No"], 0, 60);
        connectClient(sessionId, "ORGANIZER");
        mocks.findMany.mockResolvedValue([{ id: sessionId, status: "IN_PROGRESS" }]);

        await reapAbandonedPolls(T0);
        await reapAbandonedPolls(T0 + ORPHANED_HOST_GRACE_MS * 2);

        expect(getActivePoll(sessionId)).not.toBeNull();
    });

    it("reaps an empty abandoned session after EMPTY_SESSION_GRACE_MS from disconnect", async () => {
        const poll = await createPoll(sessionId, "Abandoned?", ["Yes", "No"]);
        if (!poll) throw new Error("Expected first poll to start");
        await recordPoll(sessionId, poll.id);
        const host = connectClient(sessionId, "ORGANIZER");
        mocks.findMany.mockResolvedValue([{ id: sessionId, status: "IN_PROGRESS" }]);

        // Disconnect last client and start clock
        unindexClient(host);
        markSessionDisconnected(sessionId, T0);

        await reapAbandonedPolls(T0 + EMPTY_SESSION_GRACE_MS - 1);
        expect(getActivePoll(sessionId)).not.toBeNull();
        expect(getRecordedPolls(sessionId)).toHaveLength(1);

        await reapAbandonedPolls(T0 + EMPTY_SESSION_GRACE_MS);
        expect(getActivePoll(sessionId)).toBeNull();
        expect(getRecordedPolls(sessionId)).toEqual([]);
    });

    it("preserves polls if the organizer reconnects before EMPTY_SESSION_GRACE_MS expires", async () => {
        await createPoll(sessionId, "Reloading host?", ["A", "B"]);
        const host = connectClient(sessionId, "ORGANIZER");
        mocks.findMany.mockResolvedValue([{ id: sessionId, status: "WAITING" }]);

        unindexClient(host);
        markSessionDisconnected(sessionId, T0);

        // Host reloads 10s later
        await reapAbandonedPolls(T0 + 10_000);
        connectClient(sessionId, "ORGANIZER");
        await reapAbandonedPolls(T0 + 20_000);

        expect(getActivePoll(sessionId)).not.toBeNull();
    });

    it("waits ORPHANED_HOST_GRACE_MS when participant sockets remain connected without an organizer", async () => {
        await createPoll(sessionId, "Orphaned room?", ["A", "B"]);
        connectClient(sessionId, "PARTICIPANT", "p-1");
        mocks.findMany.mockResolvedValue([{ id: sessionId, status: "IN_PROGRESS" }]);

        await reapAbandonedPolls(T0);
        await reapAbandonedPolls(T0 + EMPTY_SESSION_GRACE_MS + 1_000);
        expect(getActivePoll(sessionId)).not.toBeNull();

        await reapAbandonedPolls(T0 + ORPHANED_HOST_GRACE_MS);
        expect(getActivePoll(sessionId)).toBeNull();
    });
});
