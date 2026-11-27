import { prisma } from "@repo/db";

export interface PendingPollVote {
    pollId: string;
    optionId: string;
    participantId: string;
}

const FLUSH_INTERVAL_MS = 250;
const FLUSH_THRESHOLD = 200;

const buffers = new Map<string, Map<string, PendingPollVote>>();
const flushTimers = new Map<string, NodeJS.Timeout>();
const flushing = new Map<string, Promise<void>>();

const voteKey = (vote: PendingPollVote) => `${vote.pollId}:${vote.participantId}`;

function scheduleFlush(sessionId: string) {
    if (flushTimers.has(sessionId)) return;
    flushTimers.set(
        sessionId,
        setTimeout(() => {
            flushTimers.delete(sessionId);
            void flushSession(sessionId).catch((err) => {
                console.error(`[pollVotes] flush failed for ${sessionId}:`, err);
            });
        }, FLUSH_INTERVAL_MS),
    );
}

export function enqueuePollVote(sessionId: string, vote: PendingPollVote): boolean {
    let buffer = buffers.get(sessionId);
    if (!buffer) {
        buffer = new Map();
        buffers.set(sessionId, buffer);
    }

    const key = voteKey(vote);
    if (buffer.has(key)) return false;

    buffer.set(key, vote);
    if (buffer.size >= FLUSH_THRESHOLD) {
        void flushSession(sessionId).catch((err) => {
            console.error(`[pollVotes] flush failed for ${sessionId}:`, err);
        });
    } else {
        scheduleFlush(sessionId);
    }
    return true;
}

export async function flushSession(sessionId: string): Promise<void> {
    const currentFlush = flushing.get(sessionId);
    if (currentFlush) {
        await currentFlush;
        if ((buffers.get(sessionId)?.size ?? 0) > 0) await flushSession(sessionId);
        return;
    }

    const buffer = buffers.get(sessionId);
    if (!buffer || buffer.size === 0) return;

    const timer = flushTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        flushTimers.delete(sessionId);
    }

    const batch = [...buffer.values()];
    buffer.clear();

    const task = prisma.$transaction(async (tx) => {
        const inserted = await tx.pollVote.createManyAndReturn({
            data: batch,
            skipDuplicates: true,
            select: { pollId: true, optionId: true },
        });

        const totalsByPoll = new Map<string, number>();
        const totalsByOption = new Map<string, number>();
        for (const vote of inserted) {
            totalsByPoll.set(vote.pollId, (totalsByPoll.get(vote.pollId) ?? 0) + 1);
            totalsByOption.set(vote.optionId, (totalsByOption.get(vote.optionId) ?? 0) + 1);
        }

        await Promise.all([
            ...[...totalsByPoll].map(([pollId, count]) =>
                tx.poll.update({
                    where: { id: pollId },
                    data: { totalVotes: { increment: count } },
                }),
            ),
            ...[...totalsByOption].map(([optionId, count]) =>
                tx.pollOption.update({
                    where: { id: optionId },
                    data: { voteCount: { increment: count } },
                }),
            ),
        ]);
    });

    flushing.set(sessionId, task);
    try {
        await task;
    } catch (err) {
        const current = buffers.get(sessionId) ?? new Map<string, PendingPollVote>();
        for (const vote of batch) {
            const key = voteKey(vote);
            if (!current.has(key)) current.set(key, vote);
        }
        buffers.set(sessionId, current);
        throw err;
    } finally {
        flushing.delete(sessionId);
        if ((buffers.get(sessionId)?.size ?? 0) > 0) scheduleFlush(sessionId);
    }
}

export async function drainPollVotes(sessionId: string): Promise<void> {
    const timer = flushTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        flushTimers.delete(sessionId);
    }

    while ((buffers.get(sessionId)?.size ?? 0) > 0 || flushing.has(sessionId)) {
        await flushSession(sessionId);
    }
}

export async function drainAllPollVotes(): Promise<void> {
    await Promise.all([...new Set([...buffers.keys(), ...flushing.keys()])].map(drainPollVotes));
}
