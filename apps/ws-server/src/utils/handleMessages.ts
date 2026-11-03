import { prisma } from "@repo/db";
import WebSocket from "ws";
import type { Client } from "../index.js";
import { cache } from "../redis.js";
import { broadcastToSession } from "./broadcastTosession.js";
import { clients, sessionTimers, indexClient, unindexClient, clientsInSession } from "../clients/index.js";
import { endQuizSession } from "./endQuizSession.js";
import { getLeaderboard } from "./leaderboard.js";
import {
    getCachedSession,
    getCachedQuestions,
    getCachedParticipants,
    getCachedLeaderboard,
    invalidateParticipants,
    appendCachedParticipant,
    invalidateLeaderboard,
    invalidateSession,
    clearSessionCache,
} from './cache.js';
import {
    startQuestionTimer,
    timerDeadlineKey,
    currentQuestionKey,
    closeQuestionWindow,
    finishQuestionEarly,
} from "./timeManager.js";
import { enqueueAnswer, countAnswered, drainSession } from "./answerQueue.js";
import {
    authorizeOrganizerAction,
    getUserIdFromToken,
    isSessionOrganizer,
    sendError,
} from "./organizerAuth.js";


/**
 * Points for the fastest correct answer to a question.
 *
 * A correct answer scores from MAX_POINTS down to 1 as the clock runs out;
 * a wrong answer scores 0. Keeping the per-question maximum small means a
 * leaderboard total reads as roughly "questions answered well" rather than
 * an arbitrary four-digit number.
 */
const MAX_POINTS = 10;


/**
 * Rate-limited progress updates.
 *
 * One broadcast per answer is O(answers x clients): at 750 participants that
 * is roughly half a million socket writes in the few seconds a question takes
 * to fill, on the one thread that also has to run the countdown. The timer
 * skipped seconds and the results arrived late because of it.
 *
 * Coalescing to one update per interval keeps the bar smooth — it animates
 * between values client-side — at a fraction of the cost. The newest payload
 * always wins, and a trailing send guarantees the final count is not the one
 * that got dropped.
 */
const PROGRESS_INTERVAL_MS = 150;

interface ProgressPayload {
    questionId: string;
    answered: number;
    total: number;
    participantId?: string;
}

const progressPending = new Map<string, ProgressPayload>();
const progressTimers = new Map<string, NodeJS.Timeout>();
const progressLastSent = new Map<string, number>();

function queueProgressBroadcast(sessionId: string, payload: ProgressPayload) {
    progressPending.set(sessionId, payload);

    const now = Date.now();
    const last = progressLastSent.get(sessionId) ?? 0;
    const elapsed = now - last;

    // Enough time has passed: send immediately, so the first answer and a
    // slow trickle both show up at once rather than waiting out the interval.
    if (elapsed >= PROGRESS_INTERVAL_MS) {
        flushProgress(sessionId);
        return;
    }

    // Otherwise let the already-scheduled trailing send carry it.
    if (progressTimers.has(sessionId)) return;

    progressTimers.set(
        sessionId,
        setTimeout(() => {
            progressTimers.delete(sessionId);
            flushProgress(sessionId);
        }, PROGRESS_INTERVAL_MS - elapsed),
    );
}

function flushProgress(sessionId: string) {
    const payload = progressPending.get(sessionId);
    if (!payload) return;

    progressPending.delete(sessionId);
    progressLastSent.set(sessionId, Date.now());
    broadcastToSession(sessionId, 'quiz:answer-progress', payload);
}

/** Drop a session's progress state once its quiz is over. */
function clearProgress(sessionId: string) {
    const timer = progressTimers.get(sessionId);
    if (timer) {
        clearTimeout(timer);
        progressTimers.delete(sessionId);
    }
    progressPending.delete(sessionId);
    progressLastSent.delete(sessionId);
}




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

            const { sessionId, participantId, token } = payload;
            let { userId } = payload;

            // The role is decided here, not by the client. Anything that is
            // not a verified organizer joins as a participant, or is refused
            // when it asked to be an organizer.
            const role: Client['role'] = payload.role === 'ORGANIZER' ? 'ORGANIZER' : 'PARTICIPANT';

            if (role === 'ORGANIZER') {
                const organizerId = getUserIdFromToken(token);
                const allowed = organizerId !== null
                    && typeof sessionId === 'string'
                    && await isSessionOrganizer(organizerId, sessionId);

                if (!allowed || organizerId === null) {
                    sendError(client, 'ORGANIZER_AUTH_FAILED', 'You are not an organizer of this quiz.');
                    break;
                }

                userId = organizerId;
            }

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
                        unindexClient(existing);
                        existing.ws.terminate();
                    }
                }
            }

            // Index before overwriting sessionId: indexClient uses the old
            // value to remove the client from a previous session's group.
            indexClient(client, sessionId);

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
                        joinCode: session?.quiz.joinCode,
                        liveVideo: session?.liveVideo ?? false
                    }
                }));

                // The list above is a snapshot taken at this instant; from
                // here the organizer only hears about new arrivals through
                // 'participant:joined'. Anyone who joined while this socket
                // was still connecting sent their broadcast to nobody, and a
                // single dropped frame is never made up. Both leave the host
                // with a count that stays wrong for the rest of the lobby, so
                // the client can ask for a fresh list with 'participants:refresh'.

                // A host who reloads mid-quiz gets a fresh component in the
                // WAITING state, which put them back on "Start Game" while
                // the quiz was still running — and starting again from there
                // would have reset the room to question one. Replay the live
                // question so they land where the quiz actually is.
                if (session?.status === 'IN_PROGRESS') {
                    await sendQuizStateSnapshot(client, sessionId);
                }
            } else if (role === 'PARTICIPANT' && participantId) {
                const participant = await prisma.participant.findUnique({
                    where: { id: participantId }
                });

                const session = await getCachedSession(sessionId);

                // Keep the cache warm across the join rush instead of dropping
                // and rebuilding it for every arrival.
                const participants = await appendCachedParticipant(sessionId, participant);

                // The full list goes to the joiner alone; everyone already
                // connected only needs the one new arrival, which the client
                // appends. Broadcasting the whole list to everyone made this
                // O(n^2) - at 300 per session that is ~720MB of JSON per
                // session just to fill the lobby.
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(JSON.stringify({
                        type: 'participants:sync',
                        payload: {
                            participants,
                            joinCode: session?.quiz?.joinCode,
                            // Tells the screen to connect to the host's video.
                            liveVideo: session?.liveVideo ?? false
                        }
                    }));
                }

                broadcastToSession(sessionId, 'participant:joined', { participant });

                // Replay the in-flight question to this client alone. Without
                // it a reconnect lands on a blank screen until the organizer
                // advances, so a brief network blip costs the whole question.
                // Only a live quiz has anything to replay, so a first join
                // into the lobby skips the extra queries entirely.
                if (session?.status === 'IN_PROGRESS') {
                    await sendQuizStateSnapshot(client, sessionId);
                }
            }
            break;
        }


        /**
         * Re-send the participant list to one client.
         *
         * The lobby is otherwise built from a single snapshot at join plus
         * incremental 'participant:joined' events, so a host whose socket
         * connected during a join rush — or who missed one broadcast — shows
         * a count that never corrects itself. This lets the client reconcile
         * without reloading the page.
         *
         * Read from the cache, so a host polling this does not turn into a
         * query per poll.
         */
        case 'participants:refresh': {
            // Only the host asks for this, and the reply carries the join
            // code, so it is limited to a verified organizer and to the
            // session they joined.
            const sessionId = authorizeOrganizerAction(client, payload);
            if (!sessionId) break;

            const [session, participants] = await Promise.all([
                getCachedSession(sessionId),
                getCachedParticipants(sessionId),
            ]);

            if (client.ws.readyState !== WebSocket.OPEN) break;

            client.ws.send(JSON.stringify({
                type: 'participants:sync',
                payload: {
                    participants,
                    joinCode: session?.quiz?.joinCode,
                    liveVideo: session?.liveVideo ?? false,
                },
            }));
            break;
        }


        case 'quiz:start': {
            const sessionId = authorizeOrganizerAction(client, payload);
            if (!sessionId) break;
            // A session the super-admin cancelled (or one that already
            // ended) must not be revived by a host coming back to the lobby.
            const { count } = await prisma.quizSession.updateMany({
                where: { id: sessionId, status: { in: ['WAITING', 'IN_PROGRESS'] } },
                data: { status: 'IN_PROGRESS', startedAt: new Date() }
            });
            if (count === 0) break;
            broadcastToSession(sessionId, 'quiz:start');
            break;
        }

        case 'quiz:next-question': {
            const sessionId = authorizeOrganizerAction(client, payload);
            if (!sessionId) break;

            const { questionIndex = 0 } = payload;

            const questions = await getCachedQuestions(sessionId);


            if (!sessionId || !questions[questionIndex]) {
                // now no more question- end quiz and clean up
                // Buffered answers first: the quiz is over, so anything left
                // in the queue has no later flush to land in and the final
                // scores would be missing them permanently.
                await closeQuestionWindow(sessionId);
                await drainSession(sessionId);
                await endQuizSession(sessionId);
                await clearSessionCache(sessionId);
                clearProgress(sessionId);
                broadcastToSession(sessionId, 'quiz:ended');
                return;
            };

            const question = questions[questionIndex];

            await prisma.quizSession.update({
                where: { id: sessionId },
                data: { currentQuestionIndex: questionIndex }
            });

            // The cached session carries currentQuestionIndex for an hour, so
            // leaving it would replay a stale question to anyone who
            // reconnects — the host reloading mid-quiz most of all.
            await invalidateSession(sessionId);

            // without revealing answers
            const sanitizedQuestion = {
                ...question,
                answers: question.answers.map((ans: any) => ({
                    id: ans.id,
                    text: ans.text
                }))
            }

            broadcastToSession(sessionId, 'quiz:question', { question: sanitizedQuestion })

            // Open the progress bar at zero rather than letting it appear
            // when the first answer lands. On the host's screen, shown to the
            // room, a counter that pops into existence partway through reads
            // as a glitch; starting at 0 / n also tells the room how many are
            // playing.
            {
                const playing = [...clientsInSession(sessionId)].filter(
                    (c) => c.role === 'PARTICIPANT'
                        && c.participantId
                        && c.ws.readyState === WebSocket.OPEN,
                ).length;

                if (playing > 0) {
                    broadcastToSession(sessionId, 'quiz:answer-progress', {
                        questionId: question.id,
                        answered: 0,
                        total: playing,
                    });
                }
            }

            await startQuestionTimer(sessionId, questionIndex)
            break;
        }

        case 'quiz:submit-answer': {
            // timeMs is deliberately not read: the client's own stopwatch can
            // say anything. Time used is measured here from the deadline.
            const { sessionId, participantId, questionId, answerId } = payload;

            if (!participantId) break;

            // No pre-check for a duplicate submission: the unique constraint
            // on (participantId, questionId) rejects one with P2002, which is
            // handled below. Asking the database first would add a round-trip
            // to every answer and still not settle a race.
            const questions = await getCachedQuestions(sessionId);
            const questionIndex = questions.findIndex((q: any) => q.id === questionId);
            const question = questions[questionIndex];
            if (!question) break;

            // Only the question that is open right now, and only before its
            // deadline, can be answered. finishQuestion deletes both keys the
            // moment a question closes and closeQuestionWindow does the same
            // when the quiz ends, so a missing deadline means nothing is
            // open. Without this, the correct answers broadcast in
            // quiz:question-results could be replayed for full points by
            // anyone who had skipped the question.
            const [rawDeadline, rawCurrent] = await Promise.all([
                cache.get(timerDeadlineKey(sessionId)),
                cache.get(currentQuestionKey(sessionId)),
            ]);
            if (!rawDeadline || rawCurrent === null || Number(rawCurrent) !== questionIndex) break;

            const now = Date.now();
            const deadline = Number(rawDeadline);
            if (!Number.isFinite(deadline) || now > deadline) break;

            const answerMeta = question.answers.find((a: any) => a.id === answerId);

            const isCorrect = !!answerMeta?.isCorrect;

            // Score across the question's real time limit rather than a fixed
            // 1000ms. `1000 - timeMs` spent its whole range in the first
            // second, so on a 15s question everyone slower than 1s scored the
            // same floor: answering in 2s and in 14s were worth the same, and
            // only a bot could reach the top of the curve.
            //
            // Now a correct answer is worth MAX_POINTS down to 1, scaled over
            // the time actually allowed; a wrong answer is worth 0. Answering
            // at all still scores, so the floor is 1 rather than 0.
            const limitMs = Math.max(1, (question.timeLimit ?? 15) * 1_000);
            // Time used = time allowed minus time that was left when the
            // answer reached the server. Clamped because the timer and the
            // limit are read separately and can disagree by a few ms.
            const elapsedMs = Math.min(Math.max(limitMs - (deadline - now), 0), limitMs);
            const points = isCorrect
                ? Math.max(1, Math.ceil(MAX_POINTS * (1 - elapsedMs / limitMs)))
                : 0;

            // Buffered rather than written immediately. One transaction per
            // answer meant 750 people answering at once queued 750 of them
            // against a pool of 25, and Prisma began rejecting with "Unable
            // to start a transaction in the given time" — a third of answers
            // were lost, silently, with the participant none the wiser. The
            // queue turns that burst into a handful of bulk writes.
            //
            // A false return is a duplicate submission already buffered,
            // which is what the unique constraint would have rejected anyway.
            if (!enqueueAnswer(sessionId, {
                participantId, questionId, answerId, timeMs: elapsedMs, isCorrect, points,
            })) break;

            // The leaderboard cache has a 10s TTL and is invalidated again
            // before any read that matters, so dropping it on every single
            // answer is 750 Redis round trips to no end.

            // Everyone present has answered: close the question instead of
            // making the room watch an empty countdown. Counting live sockets
            // rather than Participant rows means someone who closed their
            // laptop cannot hold the question open to the full limit.
            const connected = [...clientsInSession(sessionId)].filter(
                (c) => c.role === 'PARTICIPANT'
                    && c.participantId
                    && c.ws.readyState === WebSocket.OPEN,
            );

            if (connected.length > 0) {
                // Counts buffered answers as well as written ones. A plain
                // database count would miss whatever is still in the queue,
                // so a question everyone had answered would look unfinished
                // and run to the full time limit.
                const answered = await countAnswered(
                    sessionId,
                    questionId,
                    connected.map((c) => c.participantId as string),
                );

                // Progress for the room, coalesced rather than sent per
                // answer. Broadcasting on every submission meant 737 answers
                // against 738 sockets — about half a million ws.send() calls
                // in the four seconds a question takes to fill — which
                // saturated the event loop: the one-second countdown could
                // not run on schedule and visibly skipped (22 straight to
                // 16), and the results that follow queued behind the
                // backlog, reaching the host seconds late.
                //
                // At most one update every 150ms carries the same
                // information: the bar is animated client-side anyway, and
                // nobody can read 737 discrete updates.
                queueProgressBroadcast(sessionId, {
                    questionId,
                    answered,
                    total: connected.length,
                    participantId,
                });

                if (answered >= connected.length) {
                    // Send the final n/n now rather than letting the trailing
                    // timer carry it: the question is about to close, and a
                    // bar that never visibly fills is what made the early
                    // finish look arbitrary.
                    flushProgress(sessionId);

                    // Index of the question just answered, taken from the
                    // question list rather than the cached session: the
                    // session cache is not invalidated when the organizer
                    // advances, so its currentQuestionIndex can be an hour
                    // stale and would close the wrong question.
                    await finishQuestionEarly(sessionId, questionIndex);
                }
            }

            break;
        }


        case 'quiz:end': {

            const sessionId = authorizeOrganizerAction(client, payload);
            if (!sessionId) break;

            if (sessionTimers.has(sessionId)) {
                clearInterval(sessionTimers.get(sessionId));
                sessionTimers.delete(sessionId);
            }

            // Stop accepting answers before draining the buffer, so nothing
            // can be queued after the final board is built.
            await closeQuestionWindow(sessionId);

            // Buffered answers must land before the final standings are
            // read, or the last question's scores are missing from the board
            // everyone finishes on.
            await drainSession(sessionId);
            clearProgress(sessionId);
            await invalidateLeaderboard(sessionId);

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


