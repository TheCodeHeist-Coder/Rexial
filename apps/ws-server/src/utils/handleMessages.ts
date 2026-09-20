import { prisma } from "@repo/db";
import WebSocket from "ws";
import type { Client } from "../index.js";
import { cache } from "../redis.js";
import { broadcastToSession } from "./broadcastTosession.js";
import { clients, sessionTimers } from "../clients/index.js";
import { endQuizSession } from "./endQuizSession.js";
import { getLeaderboard } from "./leaderboard.js";
import {
    getCachedSession,
    getCachedQuestions,
    getCachedParticipants,
    getCachedLeaderboard,
    invalidateParticipants,
    invalidateLeaderboard,
    clearSessionCache,
} from './cache.js';
import { startQuestionTimer, timerDeadlineKey } from "./timeManager.js";




/**
 * Bring a reconnecting participant back to the live question.
 *
 * Sent to the one client rather than broadcast: everyone else is already in
 * the right state, and re-broadcasting a question would reset their timers.
 */
async function sendQuizStateSnapshot(client: Client, sessionId: string) {
    const session = await getCachedSession(sessionId);

    // Nothing in flight before the quiz starts or once it is over: the normal
    // WAITING / ENDED handling already covers those.
    if (!session || session.status !== 'IN_PROGRESS') return;

    const questionIndex = session.currentQuestionIndex ?? 0;
    const questions = await getCachedQuestions(sessionId);
    const question = questions[questionIndex];
    if (!question) return;

    // How long is actually left, from the shared deadline rather than from a
    // countdown living in one instance's memory.
    const rawDeadline = await cache.get(timerDeadlineKey(sessionId));
    const timeLeft = rawDeadline
        ? Math.max(0, Math.ceil((Number(rawDeadline) - Date.now()) / 1_000))
        : 0;

    // Did this participant already answer? There is no unique constraint on
    // (participantId, questionId), so a replayed question they could answer
    // twice would score twice.
    const existingAnswer = client.participantId
        ? await prisma.participantAnswer.findFirst({
            where: { participantId: client.participantId, questionId: question.id },
            select: { answerId: true },
        })
        : null;

    const sanitizedQuestion = {
        ...question,
        answers: question.answers.map((ans: any) => ({
            id: ans.id,
            text: ans.text,
        })),
    };

    if (client.ws.readyState !== WebSocket.OPEN) return;

    client.ws.send(JSON.stringify({
        type: 'quiz:state-snapshot',
        payload: {
            question: sanitizedQuestion,
            questionIndex,
            timeLeft,
            // Already answered, or the window closed while they were away:
            // the client shows the question read-only in both cases.
            alreadyAnswered: !!existingAnswer,
            selectedAnswerId: existingAnswer?.answerId ?? null,
            expired: timeLeft <= 0,
        },
    }));
}


export const handleMessage = async (client: Client, data: any) => {
    const { type, payload } = data;

    switch (type) {
        case 'join': {

            console.log("JOIN EVENT")

            const { sessionId, role, participantId, userId } = payload;

            // A reconnecting client re-joins with the same participantId while
            // its previous socket may still be registered: the heartbeat can
            // take up to two rounds to notice a dead peer, and a background
            // tab that never fired 'close' lingers even longer. Two entries
            // for one person means every broadcast is delivered twice and the
            // participant count is inflated, so retire the stale socket now
            // rather than waiting for the heartbeat.
            if (participantId) {
                for (const existing of clients) {
                    if (existing !== client && existing.participantId === participantId) {
                        clients.delete(existing);
                        existing.ws.terminate();
                    }
                }
            }

            client.sessionId = sessionId;
            client.role = role;
            client.participantId = participantId;
            client.userId = userId;

            if (role === 'ORGANIZER') {

                const session = await getCachedSession(sessionId);
                const participants = await getCachedParticipants(sessionId);




                client.ws.send(JSON.stringify({
                    type: 'participants:sync',
                    payload: {
                        participants,
                        joinCode: session?.quiz.joinCode
                    }
                }));


                console.log("JOIN CODE FROM WS:", payload);
            } else if (role === 'PARTICIPANT' && participantId) {
                const participant = await prisma.participant.findUnique({
                    where: { id: participantId }
                });

                await invalidateParticipants(sessionId);


                const [participants, session] = await Promise.all([
                    getCachedParticipants(sessionId),
                    getCachedSession(sessionId),
                ]);



                // this will also send the joincode for the participants
                broadcastToSession(sessionId, 'participants:sync', {
                    participants,
                    joinCode: session?.quiz?.joinCode
                });

                broadcastToSession(sessionId, 'participant:joined', { participant });

                // Replay the in-flight question to this client alone. Without
                // it a reconnect lands on a blank screen until the organizer
                // advances, so a brief network blip costs the whole question.
                await sendQuizStateSnapshot(client, sessionId);
            }
            break;
        }



        case 'quiz:start': {
            const { sessionId } = payload;
            await prisma.quizSession.update({
                where: { id: sessionId },
                data: { status: 'IN_PROGRESS', startedAt: new Date() }
            });
            broadcastToSession(sessionId, 'quiz:start');
            break;
        }

        case 'quiz:next-question': {
            const { sessionId, questionIndex = 0 } = payload;

            const questions = await getCachedQuestions(sessionId);


            if (!sessionId || !questions[questionIndex]) {
                // now no more question- end quiz and clean up
                await endQuizSession(sessionId);
                await clearSessionCache(sessionId);
                broadcastToSession(sessionId, 'quiz:ended');
                return;
            };

            const question = questions[questionIndex];

            await prisma.quizSession.update({
                where: { id: sessionId },
                data: { currentQuestionIndex: questionIndex }
            });

            // without revealing answers
            const sanitizedQuestion = {
                ...question,
                answers: question.answers.map((ans: any) => ({
                    id: ans.id,
                    text: ans.text
                }))
            }

            broadcastToSession(sessionId, 'quiz:question', { question: sanitizedQuestion })

            await startQuestionTimer(sessionId, questionIndex)
            break;
        }

        case 'quiz:submit-answer': {
            const { sessionId, participantId, questionId, answerId, timeMs } = payload;

            if (!participantId) break;

            // Reject a second submission for the same question. A reconnect
            // replays the live question, so without this a participant who
            // rejoins after answering could answer again and score twice.
            const alreadyAnswered = await prisma.participantAnswer.findFirst({
                where: { participantId, questionId },
                select: { id: true },
            });
            if (alreadyAnswered) break;

            const questions = await getCachedQuestions(sessionId);
            const question = questions.find((q: any) => q.id === questionId);
            const answerMeta = question?.answers.find((a: any) => a.id === answerId);

            const isCorrect = !!answerMeta?.isCorrect;
            const points = isCorrect ? Math.max(10, 1_000 - timeMs) : 0;

            // Insert the answer first and only credit the score if it was
            // actually recorded. Running both concurrently would award points
            // even when the unique constraint rejected the answer, which is
            // exactly the double-scoring this is meant to prevent.
            try {
                await prisma.$transaction([
                    prisma.participantAnswer.create({
                        data: { participantId, questionId, answerId, timeMs, isCorrect, points },
                    }),
                    prisma.participant.update({
                        where: { id: participantId },
                        data: { score: { increment: points } },
                    }),
                ]);
            } catch (err: any) {
                // P2002 = unique constraint: a duplicate submission that raced
                // past the check above. Nothing was written; not an error.
                if (err?.code === 'P2002') break;
                throw err;
            }

            await invalidateLeaderboard(sessionId);

            break;
        }


        case 'quiz:end': {

            const { sessionId } = payload;

            if (!sessionId) break;

            if (sessionTimers.has(sessionId)) {
                clearInterval(sessionTimers.get(sessionId));
                sessionTimers.delete(sessionId);
            }

            // Read the leaderboard before the caches are dropped: both
            // endQuizSession and clearSessionCache clear it, and reading
            // afterwards would re-query the DB and repopulate what we just
            // cleared.
            const leaderboard = await getCachedLeaderboard(sessionId);

            await endQuizSession(sessionId);
            await clearSessionCache(sessionId);

            broadcastToSession(sessionId, 'quiz:leaderboard', { leaderboard });
            broadcastToSession(sessionId, 'quiz:ended');
            break;

        }
    }
}


