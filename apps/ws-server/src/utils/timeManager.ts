// utils/timerManager.ts

import { cache, pub, sessionChannel } from '../redis.js';
import { getCachedQuestions, getCachedLeaderboard,
         invalidateLeaderboard } from './cache.js';
import { broadcastToSession } from './broadcastTosession.js';
import { sessionTimers } from '../clients/index.js';
import { flushSession } from './answerQueue.js';

// Redis key that marks "a timer is already running for this question"
const timerLockKey = (sessionId: string, questionIndex: number) =>
    `quiz:timer-lock:${sessionId}:${questionIndex}`;

// Absolute epoch-ms deadline for the question currently in flight. The
// countdown itself lives in a setInterval closure on one instance, which a
// reconnecting client cannot read — this key is what lets any instance answer
// "how much time is left?" during a mid-question rejoin.
export const timerDeadlineKey = (sessionId: string) =>
    `quiz:deadline:${sessionId}`;

// Which question is in flight, so an early finish can prove it is closing the
// question it meant to and not one that already moved on.
export const currentQuestionKey = (sessionId: string) =>
    `quiz:current-q:${sessionId}`;

// Set once when a question closes, by whichever path gets there first, so the
// results cannot be revealed twice. Outlives the deadline key deliberately:
// the deadline can expire on a loaded server, this must not.
const closedKey = (sessionId: string, questionIndex: number) =>
    `quiz:closed:${sessionId}:${questionIndex}`;

/**
 * Close the question in flight: stop the countdown, reveal the answers, then
 * send the standings.
 *
 * Called both by the countdown reaching zero and by everyone answering early.
 * The Redis delete is what settles a race between those two — `del` returns
 * the number of keys it actually removed, so whichever path gets there first
 * removes the deadline and the other sees 0 and stops. Without that, a last
 * answer landing on the final tick would reveal the results twice.
 */
async function finishQuestion(
    sessionId: string,
    questionIndex: number,
    /**
     * The countdown reaching zero. It owns the close outright: the deadline
     * key carries a TTL, so under load it can expire before the final tick
     * runs, and treating that as "someone else finished it" left the timer
     * ticking into negative numbers with results that never came.
     */
    byCountdown = false,
) {
    const lockKey = timerLockKey(sessionId, questionIndex);

    // Claim the close, so the countdown and an early finish racing on the
    // last tick cannot both reveal the results. `del` reports how many keys
    // it removed, so exactly one caller sees a non-zero count.
    //
    // The countdown is exempt: if the key has already expired there is
    // nobody else to have claimed it, and bailing here would strand the
    // question open forever.
    const claimed = await cache.del(timerDeadlineKey(sessionId));
    if (claimed === 0 && !byCountdown) return;

    // The countdown's exemption above means it proceeds even when the key was
    // already gone, so on its own it would re-reveal a question an early
    // finish had just closed. This marker is what actually makes the close
    // happen once: whoever sets it first owns the question, and it outlives
    // the deadline key.
    const closedMarker = await cache.set(
        closedKey(sessionId, questionIndex), '1', 'EX', 300, 'NX',
    );
    if (closedMarker !== 'OK') return;

    const localTimer = sessionTimers.get(sessionId);
    if (localTimer) {
        clearInterval(localTimer);
        sessionTimers.delete(sessionId);
    }

    // Release the question lock so the next question can start.
    await cache.del(lockKey, currentQuestionKey(sessionId));

    const questions = await getCachedQuestions(sessionId);
    const question = questions[questionIndex];
    if (!question) return;

    // Write anything still buffered before reading standings: answers are
    // queued and flushed in batches, so the leaderboard would otherwise be
    // built from an incomplete picture and show stale scores at exactly the
    // moment everyone is looking at it.
    try {
        await flushSession(sessionId);
    } catch (err) {
        // Already logged and requeued; better a slightly stale board than no
        // results at all.
        console.error('[timer] flush before results failed', err);
    }

    await invalidateLeaderboard(sessionId);
    const leaderboard = await getCachedLeaderboard(sessionId);

    broadcastToSession(sessionId, 'quiz:question-results', {
        correctAnswers: question.answers
            .filter((a: any) => a.isCorrect)
            .map((a: any) => a.id),
    });

    setTimeout(() => {
        broadcastToSession(sessionId, 'quiz:leaderboard', { leaderboard });
    }, 2_000);
}

/**
 * Mark no question as open for this session.
 *
 * Answers are only accepted while the deadline key exists, so removing it is
 * what stops late answers once the host ends the quiz. The normal close path
 * does this itself in finishQuestion; this is for the paths that stop the
 * countdown without going through it.
 */
export async function closeQuestionWindow(sessionId: string) {
    await cache.del(timerDeadlineKey(sessionId), currentQuestionKey(sessionId));
}

/**
 * End the current question early because everyone present has answered.
 *
 * Waiting out a 20s limit when all 200 people answered by 14s is dead air, so
 * the question closes once nobody is left to answer. The short delay keeps it
 * from cutting off the moment the last person clicks, and gives an answer
 * still in flight on a slow connection a chance to land.
 */
export async function finishQuestionEarly(sessionId: string, questionIndex: number) {
    // Only end early while this question is genuinely the live one: the
    // deadline is deleted the moment it closes by any route.
    const [deadline, current] = await Promise.all([
        cache.get(timerDeadlineKey(sessionId)),
        cache.get(currentQuestionKey(sessionId)),
    ]);
    if (!deadline) return;
    if (current !== null && Number(current) !== questionIndex) return;

    setTimeout(() => {
        finishQuestion(sessionId, questionIndex).catch((err) =>
            console.error('[timer] early finish failed', err),
        );
    }, 1_500);
}

export async function startQuestionTimer(
    sessionId: string,
    questionIndex: number,
) {
    const lockKey = timerLockKey(sessionId, questionIndex);

    // NX = only set if key does NOT exist → only one instance wins the race
    // EX = auto-expire after timeLimit + 10s safety buffer
    const questions  = await getCachedQuestions(sessionId);
    const question   = questions[questionIndex];
    if (!question) return;

    const acquired = await cache.set(
        lockKey,
        '1',
        'EX', question.timeLimit + 10,
        'NX',                           // atomic: only one server wins
    );

    // Another instance already holds the lock — do nothing
    if (acquired !== 'OK') {
        console.log(`[timer] lock already held for ${sessionId}:${questionIndex}`);
        return;
    }

    console.log(`[timer] lock acquired for ${sessionId}:${questionIndex}`);

    // Clear any previous local timer for this session (safety)
    if (sessionTimers.has(sessionId)) {
        clearInterval(sessionTimers.get(sessionId));
    }

    let timeLeft = question.timeLimit;

    // Published so a mid-question rejoin can compute the real remaining time.
    // TTL generously longer than the countdown itself. At 10s of margin a
    // loaded server could expire this key before the final tick ran, and the
    // close then had nothing left to claim.
    await cache.set(
        timerDeadlineKey(sessionId),
        String(Date.now() + question.timeLimit * 1_000),
        'EX', question.timeLimit + 60,
    );

    // Lets an early finish confirm it is closing the question still in flight.
    await cache.set(
        currentQuestionKey(sessionId),
        String(questionIndex),
        'EX', question.timeLimit + 60,
    );

    broadcastToSession(sessionId, 'quiz:timer-tick', { timeLeft });

    // Absolute end time, so a tick that runs late reports the time that has
    // actually passed. Decrementing a counter instead meant a delayed tick
    // silently lost that second: under load the countdown jumped 22 -> 16 and
    // then finished early by however much it had skipped.
    const endsAt = Date.now() + question.timeLimit * 1_000;

    const timer = setInterval(() => {
        timeLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1_000));
        broadcastToSession(sessionId, 'quiz:timer-tick', { timeLeft });

        if (timeLeft <= 0) {
            // Stop ticking before closing: at 750 clients a broadcast takes
            // long enough that another tick can fire while this one is still
            // closing the question, which is how the countdown ran past zero.
            clearInterval(timer);
            sessionTimers.delete(sessionId);

            // Same close as an early finish, so the two cannot diverge.
            // Nothing awaits an interval callback, so a Redis or Postgres
            // error in here has to be caught on the spot. Left alone it is an
            // unhandled rejection, and on Node 22 that takes down the whole
            // process and every quiz running on it.
            finishQuestion(sessionId, questionIndex, true).catch((err) =>
                console.error('[timer] countdown finish failed', { sessionId, questionIndex }, err),
            );
        }
    }, 1_000);

    sessionTimers.set(sessionId, timer);
}