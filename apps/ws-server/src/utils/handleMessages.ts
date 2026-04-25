import { prisma } from "@repo/db";
import type { Client } from "../index.js";
import { broadcastToSession } from "./broadcastTosession.js";
import { sessionTimers } from "../clients/index.js";
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




export const handleMessage = async (client: Client, data: any) => {
    const { type, payload } = data;

    switch (type) {
        case 'join': {
           
            console.log("JOIN EVENT")

            const { sessionId, role, participantId, userId } = payload;
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
                answers: question.answers.map((ans:any) => ({
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

            broadcastToSession(sessionId, 'quiz:timer-tick', { timeLeft: timeleft });

             const timer = setInterval(async () => {
                timeleft--;
                broadcastToSession(sessionId, 'quiz:timer-tick', { timeleft });

                if (timeleft <= 0) {
                    clearInterval(timer);
                    sessionTimers.delete(sessionId);

                    // Invalidate leaderboard so getCachedLeaderboard fetches
                    // fresh scores that reflect all answers just submitted
                    await invalidateLeaderboard(sessionId);
                    const leaderboard = await getCachedLeaderboard(sessionId);

                    // Reveal correct answers immediately…
                    broadcastToSession(sessionId, 'quiz:question-results', {
                        correctAnswers: question.answers
                            .filter((ans: any) => ans.isCorrect)
                            .map((ans: any) => ans.id),
                    });

                    // …then show the leaderboard 2 s later
                    setTimeout(() => {
                        broadcastToSession(sessionId, 'quiz:leaderboard', { leaderboard });
                    }, 2_000);
                }
            }, 1_000);


            sessionTimers.set(sessionId, timer);
            break;
        }

        case 'quiz:submit-answer': {
            const { sessionId, participantId, questionId, answerId, timeMs } = payload;

            if (!participantId) break;

           const questions  = await getCachedQuestions(sessionId);
            const question   = questions.find((q: any) => q.id === questionId);
            const answerMeta = question?.answers.find((a: any) => a.id === answerId);

              const isCorrect = !!answerMeta?.isCorrect;
              const points    = isCorrect ? Math.max(10, 1_000 - timeMs) : 0;
                      
               await Promise.all([
                prisma.participantAnswer.create({
                    data: { participantId, questionId, answerId, timeMs, isCorrect, points },
                }),
                prisma.participant.update({
                    where: { id: participantId },
                    data: { score: { increment: points } },
                }),
            ]);

            await invalidateLeaderboard(sessionId);

            break;
        }


        case 'quiz:end': {

            const [sessionId] = payload;

            if (sessionTimers.has(sessionId)) {
                clearInterval(sessionTimers.get(sessionId));
                sessionTimers.delete(sessionId);
            }

            await endQuizSession(sessionId);
              await clearSessionCache(sessionId);

            const leaderboard = await getCachedLeaderboard(sessionId);
            broadcastToSession(sessionId, 'quiz:leaderboard', { leaderboard });
            broadcastToSession(sessionId, 'quiz:ended');
            break;

        }
    }
}


