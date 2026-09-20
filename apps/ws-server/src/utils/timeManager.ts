// utils/timerManager.ts

import { cache, pub, sessionChannel } from '../redis.js';
import { getCachedQuestions, getCachedLeaderboard,
         invalidateLeaderboard } from './cache.js';
import { broadcastToSession } from './broadcastTosession.js';
import { sessionTimers } from '../clients/index.js';

// Redis key that marks "a timer is already running for this question"
const timerLockKey = (sessionId: string, questionIndex: number) =>
    `quiz:timer-lock:${sessionId}:${questionIndex}`;

// Absolute epoch-ms deadline for the question currently in flight. The
// countdown itself lives in a setInterval closure on one instance, which a
// reconnecting client cannot read — this key is what lets any instance answer
// "how much time is left?" during a mid-question rejoin.
export const timerDeadlineKey = (sessionId: string) =>
    `quiz:deadline:${sessionId}`;

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
    await cache.set(
        timerDeadlineKey(sessionId),
        String(Date.now() + question.timeLimit * 1_000),
        'EX', question.timeLimit + 10,
    );

    broadcastToSession(sessionId, 'quiz:timer-tick', { timeLeft });

    const timer = setInterval(async () => {
        timeLeft--;
        broadcastToSession(sessionId, 'quiz:timer-tick', { timeLeft });

        if (timeLeft <= 0) {
            clearInterval(timer);
            sessionTimers.delete(sessionId);

            // Release the lock immediately so a new question can start.
            // The deadline goes with it: the question is over, so a rejoin
            // from here on should see results, not a live countdown.
            await cache.del(lockKey, timerDeadlineKey(sessionId));

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
    }, 1_000);

    sessionTimers.set(sessionId, timer);
}