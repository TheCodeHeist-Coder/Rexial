import WebSocket from "ws";
import { prisma } from "@repo/db";
import { clientsInSession } from "../clients/index.js";
import { clearSessionPolls, listTrackedPollSessionIds } from "./pollManager.js";

/** How often in-memory poll maps are checked against session state. */
export const POLL_REAP_INTERVAL_MS = 10_000;

/**
 * Grace period once every socket in a session has closed. Long enough that a
 * host or sole player reloading never loses an active lobby poll, short enough
 * to bound memory growth from abandoned rooms.
 */
export const EMPTY_SESSION_GRACE_MS = 60_000;

/**
 * Grace period when no organizer is connected but participant sockets remain
 * open on an abandoned WAITING / IN_PROGRESS session.
 */
export const ORPHANED_HOST_GRACE_MS = 5 * 60_000;

// Session id -> first timestamp seen with no connected organizer.
const absentSince = new Map<string, number>();

function hasConnectedOrganizer(sessionId: string): boolean {
    for (const client of clientsInSession(sessionId)) {
        if (client.role === "ORGANIZER" && client.ws.readyState === WebSocket.OPEN) {
            return true;
        }
    }
    return false;
}

/**
 * Record the moment the last organizer leaves a tracked poll session so
 * disconnect events start the abandonment clock without interrupting reloads.
 */
export function markSessionDisconnected(sessionId: string, now = Date.now()) {
    if (!sessionId || hasConnectedOrganizer(sessionId)) return;
    if (!absentSince.has(sessionId) && listTrackedPollSessionIds().includes(sessionId)) {
        absentSince.set(sessionId, now);
    }
}

/** One sweep over sessions holding in-memory poll state. Exported for tests. */
export async function reapAbandonedPolls(now = Date.now()) {
    const trackedIds = listTrackedPollSessionIds();
    const trackedSet = new Set(trackedIds);

    for (const sessionId of absentSince.keys()) {
        if (!trackedSet.has(sessionId)) {
            absentSince.delete(sessionId);
        }
    }

    if (trackedIds.length === 0) return;

    const sessions = await prisma.quizSession.findMany({
        where: { id: { in: trackedIds } },
        select: { id: true, status: true },
    });
    const byId = new Map(sessions.map((s) => [s.id, s]));

    for (const sessionId of trackedIds) {
        const session = byId.get(sessionId);

        if (!session || session.status === "COMPLETED" || session.status === "CANCELLED") {
            clearSessionPolls(sessionId);
            absentSince.delete(sessionId);
            continue;
        }

        if (hasConnectedOrganizer(sessionId)) {
            absentSince.delete(sessionId);
            continue;
        }

        const since = absentSince.get(sessionId);
        if (since === undefined) {
            absentSince.set(sessionId, now);
            continue;
        }

        const graceMs =
            clientsInSession(sessionId).size === 0 ? EMPTY_SESSION_GRACE_MS : ORPHANED_HOST_GRACE_MS;

        if (now - since >= graceMs) {
            clearSessionPolls(sessionId);
            absentSince.delete(sessionId);
        }
    }
}

export function startPollReaper(): NodeJS.Timeout {
    let running = false;

    const timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
            await reapAbandonedPolls();
        } catch (err) {
            console.error("[pollReaper] sweep failed", err);
        } finally {
            running = false;
        }
    }, POLL_REAP_INTERVAL_MS);

    timer.unref?.();
    return timer;
}
