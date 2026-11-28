import { randomUUID } from "crypto";
import { prisma } from "@repo/db";
import { drainPollVotes, enqueuePollVote } from "./pollVoteQueue.js";

/**
 * Bounds for a poll created over the socket. The host UI already caps these
 * lower (6 options, 200-character questions, 80-character options, preset
 * timers), so these are the backstop for anyone talking to the socket
 * directly. They mirror the question bounds in `questionInput.ts`.
 */
export const MAX_POLL_OPTIONS = 10;
export const MAX_POLL_QUESTION_LENGTH = 300;
export const MAX_POLL_OPTION_LENGTH = 120;
export const MAX_POLL_DURATION = 600; // 10 minutes
export const MIN_POLL_DURATION = 5;

export interface PollOptionState {
    id: string;
    text: string;
    order: number;
    voteCount: number;
    percentage: number;
}

export interface ActivePoll {
    id: string;
    sessionId: string;
    question: string;
    questionIndex?: number | null | undefined;
    status: 'ACTIVE' | 'ENDED';
    isRecorded: boolean;
    totalVotes: number;
    createdAt: number;
    endedAt?: number | null | undefined;
    recordedAt?: number | null | undefined;
    duration?: number | null | undefined;
    options: PollOptionState[];
    voters: Map<string, string>; // participantId -> optionId
}

// Active poll per session: at most one active poll per session at any time.
const activePolls = new Map<string, ActivePoll>();
const creatingPolls = new Set<string>();
const endingPolls = new Set<string>();

// In-memory cache of recorded polls per session
const recordedPollsCache = new Map<string, ActivePoll[]>();

// Timers for polls with duration
const pollTimers = new Map<string, NodeJS.Timeout>();

export function getActivePoll(sessionId: string): ActivePoll | null {
    return activePolls.get(sessionId) ?? null;
}

export function sanitizePoll(poll: ActivePoll, participantId?: string) {
    return {
        id: poll.id,
        sessionId: poll.sessionId,
        question: poll.question,
        questionIndex: poll.questionIndex,
        status: poll.status,
        isRecorded: poll.isRecorded,
        totalVotes: poll.totalVotes,
        createdAt: poll.createdAt,
        endedAt: poll.endedAt ?? null,
        recordedAt: poll.recordedAt ?? null,
        duration: poll.duration ?? null,
        options: poll.options.map(opt => ({
            id: opt.id,
            text: opt.text,
            order: opt.order,
            voteCount: opt.voteCount,
            percentage: opt.percentage,
        })),
        ...(participantId ? { votedOptionId: poll.voters.get(participantId) ?? null } : {}),
    };
}

export async function createPoll(
    sessionId: string,
    question: string,
    options: string[],
    questionIndex?: number,
    duration?: number,
    onExpire?: () => void,
): Promise<ActivePoll | null> {
    if (creatingPolls.has(sessionId) || getActivePoll(sessionId)?.status === 'ACTIVE') return null;
    creatingPolls.add(sessionId);

    const pollId = randomUUID();
    const cleanOptions: PollOptionState[] = options
        .filter(opt => opt && typeof opt === 'string' && opt.trim().length > 0)
        .map((text, idx) => ({
            id: randomUUID(),
            text: text.trim(),
            order: idx,
            voteCount: 0,
            percentage: 0,
        }));

    const poll: ActivePoll = {
        id: pollId,
        sessionId,
        question: question.trim(),
        questionIndex: typeof questionIndex === 'number' ? questionIndex : null,
        status: 'ACTIVE',
        isRecorded: false,
        totalVotes: 0,
        createdAt: Date.now(),
        endedAt: null,
        recordedAt: null,
        duration: duration && duration > 0 ? duration : null,
        options: cleanOptions,
        voters: new Map<string, string>(),
    };

    try {
        await prisma.poll.create({
            data: {
                id: poll.id,
                sessionId: poll.sessionId,
                question: poll.question,
                questionIndex: poll.questionIndex ?? null,
                status: poll.status,
                isRecorded: poll.isRecorded,
                totalVotes: poll.totalVotes,
                createdAt: new Date(poll.createdAt),
                options: {
                    create: poll.options.map((opt) => ({
                        id: opt.id,
                        text: opt.text,
                        order: opt.order,
                        voteCount: opt.voteCount,
                    })),
                },
            },
        });

        activePolls.set(sessionId, poll);
        if (duration && duration > 0) {
            const timer = setTimeout(() => {
                pollTimers.delete(sessionId);
                void endPoll(sessionId, poll.id)
                    .then((ended) => {
                        if (ended && onExpire) onExpire();
                    })
                    .catch((err) => {
                        console.error(`[pollManager] Failed to end expired poll ${poll.id}:`, err);
                    });
            }, duration * 1000);
            pollTimers.set(sessionId, timer);
        }
        return poll;
    } finally {
        creatingPolls.delete(sessionId);
    }
}

export function votePoll(
    sessionId: string,
    pollId: string,
    optionId: string,
    participantId: string,
): { success: boolean; poll?: ActivePoll; error?: string } {
    const poll = activePolls.get(sessionId);
    if (!poll || poll.id !== pollId) {
        return { success: false, error: 'POLL_NOT_FOUND' };
    }
    if (poll.status !== 'ACTIVE' || endingPolls.has(sessionId)) {
        return { success: false, error: 'POLL_INACTIVE' };
    }
    if (poll.voters.has(participantId)) {
        return { success: false, error: 'ALREADY_VOTED' };
    }
    const option = poll.options.find(o => o.id === optionId);
    if (!option) {
        return { success: false, error: 'INVALID_OPTION' };
    }

    if (!enqueuePollVote(sessionId, { pollId, optionId, participantId })) {
        return { success: false, error: 'ALREADY_VOTED' };
    }

    poll.voters.set(participantId, optionId);
    option.voteCount++;
    poll.totalVotes++;

    // Recalculate percentage for all options
    for (const opt of poll.options) {
        opt.percentage = poll.totalVotes > 0
            ? Math.round((opt.voteCount / poll.totalVotes) * 100)
            : 0;
    }

    return { success: true, poll };
}

export async function endPoll(sessionId: string, pollId: string): Promise<ActivePoll | null> {
    const poll = activePolls.get(sessionId);
    if (!poll || poll.id !== pollId || endingPolls.has(sessionId)) return null;
    endingPolls.add(sessionId);

    try {
        await drainPollVotes(sessionId);
        const endedAt = Date.now();
        await prisma.poll.update({
            where: { id: poll.id },
            data: { status: 'ENDED', endedAt: new Date(endedAt) },
        });

        const timer = pollTimers.get(sessionId);
        if (timer) {
            clearTimeout(timer);
            pollTimers.delete(sessionId);
        }
        poll.status = 'ENDED';
        poll.endedAt = endedAt;
        return poll;
    } finally {
        endingPolls.delete(sessionId);
    }
}

export async function recordPoll(sessionId: string, pollId: string): Promise<{ success: boolean; poll?: ActivePoll; error?: string }> {
    const poll = activePolls.get(sessionId);
    if (!poll || poll.id !== pollId) {
        return { success: false, error: 'POLL_NOT_FOUND' };
    }

    try {
        await drainPollVotes(sessionId);
        const recordedAt = Date.now();
        await prisma.poll.update({
            where: { id: poll.id },
            data: { isRecorded: true, recordedAt: new Date(recordedAt) },
        });
        poll.isRecorded = true;
        poll.recordedAt = recordedAt;

        const sessionRecorded = recordedPollsCache.get(sessionId) ?? [];
        if (!sessionRecorded.some((p) => p.id === poll.id)) {
            sessionRecorded.push({
                ...poll,
                voters: new Map(poll.voters),
                options: poll.options.map((o) => ({ ...o })),
            });
            recordedPollsCache.set(sessionId, sessionRecorded);
        }
        return { success: true, poll };
    } catch (err) {
        console.error(`[pollManager] Failed to persist poll ${poll.id} to DB:`, err);
        return { success: false, error: 'POLL_PERSISTENCE_FAILED' };
    }
}

export function dismissPoll(sessionId: string, pollId: string): boolean {
    const poll = activePolls.get(sessionId);
    if (!poll || poll.id !== pollId) return false;

    const timer = pollTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        pollTimers.delete(sessionId);
    }

    activePolls.delete(sessionId);
    return true;
}

export function getRecordedPolls(sessionId: string): ActivePoll[] {
    return recordedPollsCache.get(sessionId) ?? [];
}

export function listTrackedPollSessionIds(): string[] {
    return Array.from(
        new Set([
            ...activePolls.keys(),
            ...recordedPollsCache.keys(),
            ...pollTimers.keys(),
        ]),
    );
}

export async function clearSessionPolls(sessionId: string): Promise<void> {
    await drainPollVotes(sessionId);
    const timer = pollTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        pollTimers.delete(sessionId);
    }
    activePolls.delete(sessionId);
    recordedPollsCache.delete(sessionId);
    creatingPolls.delete(sessionId);
    endingPolls.delete(sessionId);
}
