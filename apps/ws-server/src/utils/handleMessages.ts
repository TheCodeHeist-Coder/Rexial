import { prisma } from "@repo/db";
import type { Client } from "../index.js";
import { broadcastToSession } from "./broadcastTosession.js";
import { sessionTimers } from "../clients/index.js";
import { endQuizSession } from "./endQuizSession.js";
import { getLeaderboard } from "./leaderboard.js";




const handleMessage = async (client: Client, data: any) => {
    const { type, payload } = data;

    switch (type) {
        case 'join': {
            const { sessionId, role, participantId, userId } = payload;
            client.sessionId = sessionId;
            client.role = role;
            client.participantId = participantId;
            client.userId = userId;

            if (role === 'ORGANIZER') {
                const participants = await prisma.participant.findMany({
                    where: { sessionId }
                });

                client.ws.send(JSON.stringify({
                    type: 'participants',
                    payload: { participants }
                }));
            } else if (role === 'PARTICIPANT' && participantId) {
                const participant = await prisma.participant.findUnique({
                    where: { id: participantId }
                });

                broadcastToSession(sessionId, 'participant:joined', { participant });
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

            const session = await prisma.quizSession.findUnique({
                where: { id: sessionId },
                include: {
                    quiz: {
                        include: {
                            questions: {
                                orderBy: { order: 'desc' },
                                include: { answers: true }
                            }
                        }
                    }
                }
            })

            if (!sessionId || !session?.quiz.questions[questionIndex]) {
                // now no more question- end quiz and clean up
                await endQuizSession(sessionId);
                broadcastToSession(sessionId, 'quiz:ended');
                return;
            };

            const question = session.quiz.questions[questionIndex];

            await prisma.quizSession.update({
                where: { id: sessionId },
                data: { currentQuestionIndex: questionIndex }
            });

            // without revealing answers
            const sanitizedQuestion = {
                ...question,
                answers: question.answers.map((ans) => ({
                    id: ans.id,
                    text: ans.text
                }))
            }

            broadcastToSession(sessionId, 'quiz:question', { question: sanitizedQuestion })

            // start timer
            let timeleft = question.timeLimit;
            if (sessionTimers.has(sessionId)) {
                clearInterval(sessionTimers.get(sessionId));
            }

            broadcastToSession(sessionId, 'quiz:timer-tick', { timeleft });

            const timer = setInterval(async () => {
                timeleft--;
                broadcastToSession(sessionId, 'quiz:timer-tick', { timeleft });

                if (timeleft <= 0) {
                    clearInterval(timer);
                    sessionTimers.delete(sessionId);
                }

                // now broadcasting result sna leaderboard
                const leaderboard = await getLeaderboard(sessionId);
                broadcastToSession(sessionId, 'quiz:question-results', { correctAnswers: question.answers.filter((ans) => ans.isCorrect).map(ans => ans.id) })
                setTimeout(() => broadcastToSession(sessionId, 'quiz:leaderboard', { leaderboard }), 2000);
            }, 1000)

            sessionTimers.set(sessionId, timer);
            break;
        }

        case 'quiz:submit-answer': {
            const { sessionId, participantId, questionId, answerId, timeMs } = payload;

            if (!participantId) break;

            const answer = await prisma.answer.findUnique({
                where: { id: answerId }
            });

            // simple scoring
            const points = answer?.isCorrect ? Math.max(10, 1000 - timeMs) : 0;

            await prisma.participantAnswer.create({
                data: {
                    participantId,
                    questionId,
                    answerId,
                    timeMs,
                    isCorrect: !!answer?.isCorrect,
                    points
                }
            });

            await prisma.participant.update({
                where: { id: participantId },
                data: {
                    score: { increment: points }

                }
            });
            break;
        }


        case 'quiz:end': {

            const [sessionId] = payload;

            if (sessionTimers.has(sessionId)) {
                clearInterval(sessionTimers.get(sessionId));
                sessionTimers.delete(sessionId);
            }

            await endQuizSession(sessionId);

            const leaderboard = await getLeaderboard(sessionId);
            broadcastToSession(sessionId, 'quiz:leaderboard', { leaderboard });
            broadcastToSession(sessionId, 'quiz:ended');
            break;

        }
    }
}


