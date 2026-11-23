import { prisma } from "@repo/db";
import {
    recordAnswerQueueFlushFailure,
    recordAnswerQueueTransactionError,
    recordAnswerSubmitted,
    recordAnswersPersisted,
} from "./metrics.js";

/**
 * Buffered writer for answer submissions.
 *
 * A question closing sends every participant's answer within a second or two.
 * Written one at a time that is three database round trips each — insert the
 * answer, increment the score, count how many have answered — so 750 people
 * meant well over two thousand operations competing for a connection pool of
 * 25. Past roughly 500 participants the pool could not keep up and Prisma
 * started rejecting transactions with "Unable to start a transaction in the
 * given time": a third of answers were silently dropped, with the participant
 * seeing their choice highlighted and no points for it.
 *
 * Buffering turns that burst into a handful of bulk statements. 750 answers
 * become roughly eight flushes of two statements each, which the pool handles
 * comfortably.
 *
 * The cost is that an answer is durable a fraction of a second after it is
 * acknowledged rather than immediately. Everything that reads answers goes
 * through `countAnswered` below, which adds the rows still in the buffer, so
 * nothing downstream can observe the gap.
 */

export interface PendingAnswer {
    participantId: string;
    questionId: string;
    answerId: string;
    timeMs: number;
    isCorrect: boolean;
    points: number;
}

/** How long a buffered answer may wait before it is written. */
const FLUSH_INTERVAL_MS = 250;

/** Flush immediately once this many answers are waiting, rather than idling. */
const FLUSH_THRESHOLD = 200;

/** Buffered answers per session, keyed sessionId -> participantId:questionId. */
const buffers = new Map<string, Map<string, PendingAnswer>>();
const flushTimers = new Map<string, NodeJS.Timeout>();

/** Sessions whose flush is in flight, so two do not overlap. */
const flushing = new Set<string>();

/** Questions touched per session, so draining can clear its bookkeeping. */
const questionsBySession = new Map<string, Set<string>>();

const bufferKey = (participantId: string, questionId: string) =>
    `${participantId}:${questionId}`;

/**
 * Queue an answer for writing.
 *
 * Returns false when this participant already has an answer for this question
 * in the buffer — the same duplicate the unique constraint would reject, but
 * caught before it reaches the database.
 */
export function enqueueAnswer(sessionId: string, answer: PendingAnswer): boolean {
    let buffer = buffers.get(sessionId);
    if (!buffer) {
        buffer = new Map();
        buffers.set(sessionId, buffer);
    }

    const key = bufferKey(answer.participantId, answer.questionId);
    if (buffer.has(key)) return false;

    // Already flushed: the buffer no longer holds it, so the buffer check
    // alone would let a resubmission through. The unique constraint would
    // still reject the write, but countAnswered would have counted the same
    // person twice in the meantime and could finish the question early.
    if (writtenByQuestion.get(answer.questionId)?.has(answer.participantId)) {
        return false;
    }

    buffer.set(key, answer);
    recordAnswerSubmitted();

    let seen = questionsBySession.get(sessionId);
    if (!seen) {
        seen = new Set();
        questionsBySession.set(sessionId, seen);
    }
    seen.add(answer.questionId);

    if (buffer.size >= FLUSH_THRESHOLD) {
        void flushSession(sessionId);
    } else if (!flushTimers.has(sessionId)) {
        flushTimers.set(
            sessionId,
            setTimeout(() => {
                flushTimers.delete(sessionId);
                void flushSession(sessionId);
            }, FLUSH_INTERVAL_MS),
        );
    }

    return true;
}

/**
 * How many of these participants have answered this question, counting rows
 * still in the buffer.
 *
 * The early finish and the progress bar both depend on this. Reading only the
 * database would undercount by whatever is buffered, so a question where
 * everyone had answered could still look unfinished.
 */
export async function countAnswered(
    sessionId: string,
    questionId: string,
    participantIds: string[],
): Promise<number> {
    if (participantIds.length === 0) return 0;

    const asked = new Set(participantIds);

    // Counted in memory from what has been flushed, so this costs nothing per
    // answer. Running a COUNT here instead meant one query per submission —
    // 750 of them as a question closed, which was a third of the load that
    // exhausted the pool in the first place.
    let total = 0;
    const written = writtenByQuestion.get(questionId);
    if (written) {
        for (const id of written) if (asked.has(id)) total++;
    }

    const buffer = buffers.get(sessionId);
    if (buffer) {
        for (const pending of buffer.values()) {
            if (pending.questionId === questionId && asked.has(pending.participantId)) {
                total++;
            }
        }
    }

    return total;
}

/**
 * Participants whose answer has been written, per question.
 *
 * Lets `countAnswered` answer from memory. Only one question is in flight at
 * a time and the entries are dropped when the session is drained, so this
 * stays small.
 */
const writtenByQuestion = new Map<string, Set<string>>();

function recordWritten(questionId: string, participantId: string) {
    let set = writtenByQuestion.get(questionId);
    if (!set) {
        set = new Set();
        writtenByQuestion.set(questionId, set);
    }
    set.add(participantId);
}

/**
 * Write everything buffered for a session.
 *
 * Two statements: one bulk insert of the answers, one update per distinct
 * score increment. `skipDuplicates` lets the unique constraint absorb a
 * resubmission without failing the whole batch, and the scores are credited
 * from what the insert actually accepted so a rejected duplicate cannot be
 * paid twice.
 */
export async function flushSession(sessionId: string): Promise<void> {
    if (flushing.has(sessionId)) return;

    const buffer = buffers.get(sessionId);
    if (!buffer || buffer.size === 0) return;

    flushing.add(sessionId);

    // Take the batch out of the buffer before awaiting: answers arriving
    // during the write belong to the next flush, not this one.
    const batch = [...buffer.values()];
    buffer.clear();

    const timer = flushTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        flushTimers.delete(sessionId);
    }

    try {
        const inserted = await prisma.participantAnswer.createManyAndReturn({
            data: batch.map((a) => ({
                participantId: a.participantId,
                questionId: a.questionId,
                answerId: a.answerId,
                timeMs: a.timeMs,
                isCorrect: a.isCorrect,
                points: a.points,
            })),
            skipDuplicates: true,
            select: { participantId: true, points: true },
        });
        recordAnswersPersisted(inserted.length);

        // Remember who is now written, so countAnswered can work from memory
        // rather than querying once per submission.
        for (const a of batch) recordWritten(a.questionId, a.participantId);

        // Credit only what was actually inserted. Grouping by amount means a
        // burst of 750 becomes a handful of updates rather than 750.
        const byPoints = new Map<number, string[]>();
        for (const row of inserted) {
            if (row.points <= 0) continue;
            const ids = byPoints.get(row.points);
            if (ids) ids.push(row.participantId);
            else byPoints.set(row.points, [row.participantId]);
        }

        if (byPoints.size > 0) {
            try {
                await prisma.$transaction(
                    [...byPoints.entries()].map(([points, ids]) =>
                        prisma.participant.updateMany({
                            where: { id: { in: ids } },
                            data: { score: { increment: points } },
                        }),
                    ),
                );
            } catch (err) {
                recordAnswerQueueTransactionError();
                throw err;
            }
        }
    } catch (err) {
        recordAnswerQueueFlushFailure();
        // Put the batch back so the next flush retries it, rather than losing
        // answers people have already given. Entries that arrived meanwhile
        // win, since they are newer.
        const current = buffers.get(sessionId);
        if (current) {
            for (const a of batch) {
                const key = bufferKey(a.participantId, a.questionId);
                if (!current.has(key)) current.set(key, a);
            }
        }
        console.error(`[answers] flush failed for ${sessionId}, ${batch.length} requeued:`, err);
        throw err;
    } finally {
        flushing.delete(sessionId);
    }
}

/**
 * Flush and forget a session.
 *
 * Called when a quiz ends, so the final leaderboard is built from every
 * answer and nothing is left buffered for a session nobody is in.
 */
export async function drainSession(sessionId: string): Promise<void> {
    const timer = flushTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        flushTimers.delete(sessionId);
    }

    try {
        await flushSession(sessionId);
    } catch {
        // flushSession already logged and requeued; a session that is ending
        // has nowhere to retry to, so do not take the caller down with it.
    }

    // Drop the per-question bookkeeping for this session, so a long-running
    // server does not accumulate a set per question ever asked.
    const seen = questionsBySession.get(sessionId);
    if (seen) {
        for (const questionId of seen) writtenByQuestion.delete(questionId);
        questionsBySession.delete(sessionId);
    }

    buffers.delete(sessionId);
}

/** Flush every session; used on shutdown so a deploy does not drop answers. */
export async function drainAll(): Promise<void> {
    await Promise.all([...buffers.keys()].map((id) => drainSession(id)));
}
