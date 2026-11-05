import { Request, Response } from 'express';
import { errorResponse } from '../utils/error';
import { prisma } from '@repo/db';
import { generateCode } from '../utils/code';
import { parseCreateQuestion } from '../utils/questionInput';
import { parseCreateQuiz } from '../utils/quizInput';
import { renumberQuestions } from '../utils/questionOrder';

export const createQuizController = async (req: Request, res: Response) => {
    try {

        const parsed = parseCreateQuiz(req.body);
        if (!parsed.ok) return errorResponse(res, 400, parsed.error);

        const { title, description } = parsed.data;

        const quiz = await prisma.quiz.create({
            data: {
                title,
                description,
                creatorId: req.userId,
                quizOrganizers: {
                    create: {
                        userId: req.userId,
                        role: 'OWNER',
                        inviteStatus: 'ACCEPTED'
                    }
                }
            }
        })

        return res.status(201).json(quiz);

    } catch (error) {
        console.log("Quiz creation errror: ", error);
        return errorResponse(res, 500, "Internal Srever Erorr")
    }
}



export const getAllQuizesController = async (req: Request, res: Response) => {
    try {

        const organizedQuizes = await prisma.quiz.findMany({
            where: {
                quizOrganizers: {
                    some: {
                        userId: req.userId,
                        inviteStatus: 'ACCEPTED'
                    }
                }
            },
            include: {
                _count: { select: { questions: true, quizSessions: true } }
            },
            orderBy: { createdAt: 'desc' }
        });


        const participatedQuizes = await prisma.quizSession.findMany({
            where: {
                participants: {
                    some: {
                        userId: req.userId,
                    }
                }
            },
            include: {
                quiz: true,
                participants: {
                    where: {
                        userId: req.userId
                    }
                },
                // Total players in the session, so a past quiz can say
                // "12th of 300" rather than just a score with no context.
                _count: { select: { participants: true } }
            },
            orderBy: { createdAt: 'desc' }

        });

        // Rank is a position within a session, which SQL will not give us from
        // the query above. Counting how many beat each player is one query for
        // the whole dashboard rather than one per quiz.
        const myParticipantIds = participatedQuizes
            .map((s) => s.participants[0]?.id)
            .filter((id): id is string => Boolean(id));

        const ranks = new Map<string, number>();
        if (myParticipantIds.length > 0) {
            const rows = await prisma.$queryRaw<{ id: string; rank: number }[]>`
                SELECT me.id,
                       (
                         SELECT count(*) + 1
                         FROM "Participant" other
                         WHERE other."sessionId" = me."sessionId"
                           AND other.score > me.score
                       )::int AS rank
                FROM "Participant" me
                WHERE me.id = ANY(${myParticipantIds})
            `;
            for (const row of rows) ranks.set(row.id, row.rank);
        }

        const participatedWithRank = participatedQuizes.map((session) => ({
            ...session,
            totalParticipants: session._count.participants,
            myRank: ranks.get(session.participants[0]?.id ?? '') ?? null,
        }));


        return res.status(200).json({
            organizedQuizes,
            participated: participatedWithRank
        })

    } catch (error) {
        console.log("Get all quizes error: ", error);
        return errorResponse(res, 500, "Internal Srever Erorr")
    }
}




// getting quiz by id
export const getQuizByIdController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;


        const quiz = await prisma.quiz.findUnique({
            where: {
                id: quizId as string,
                quizOrganizers: {
                    some: {
                        userId: req.userId,
                        inviteStatus: 'ACCEPTED'
                    }
                }
            },
            include: {
                questions: {
                    include: { answers: true },
                    orderBy: { order: 'asc' }
                },
                quizOrganizers: {
                    include: {
                        user: {
                            select: { name: true, email: true }
                        }
                    }
                }
            },

        })


        if (!quiz) return errorResponse(res, 404, "Quiz not found or you don't have access to it");

        return res.status(200).json(quiz);
    } catch (error) {
        console.log("Get quiz by id error: ", error);
        return errorResponse(res, 500, "Internal Srever Erorr")

    }
}





// to generate the access-code for a quiz session to join 
export const generateAccessCodeController = async (req: Request, res: Response) => {
    try {

        const { quizId } = req.params;

        const isOrganizer = await prisma.quizOrganizer.findFirst({
            where: {
                quizId: quizId as string,
                userId: req.userId,
                inviteStatus: 'ACCEPTED'
            }
        })

        if (!isOrganizer) return errorResponse(res, 403, "You don't have access to this quiz")

        for (let i = 0; i < 5; i++) {
            const code = generateCode();

            const isCodeExisted = await prisma.quiz.findUnique({
                where: {
                    joinCode: code
                }
            })

            if (!isCodeExisted) {
                const quiz = await prisma.quiz.update({
                    where: {
                        id: quizId as string
                    },
                    data: {
                        joinCode: code, status: 'ACTIVE'
                    }
                });
                return res.status(200).json({ joinCode: quiz.joinCode });
            }
        }

        return errorResponse(res, 500, "Couldn't generate a unique access code, please try again")

    } catch (error) {

        console.log("Generate access code error: ", error);
        return errorResponse(res, 500, "Internal Srever Erorr")

    }
}



// creating question for a quiz
export const createQuestionController = async (req: Request, res: Response) => {
    try {
        const { quizId } = req.params;

        const parsed = parseCreateQuestion(req.body);
        if (!parsed.ok) return errorResponse(res, 400, parsed.error);

        const { text, timeLimit, answers, difficulty } = parsed.data;

        const isOrganizer = await prisma.quizOrganizer.findFirst({
            where: {
                quizId: quizId as string,
                userId: req.userId,
                inviteStatus: 'ACCEPTED'
            }
        })

        if (!isOrganizer) return errorResponse(res, 403, "You don't have access to this quiz");

        // The quiz row is locked so two requests adding (or deleting) at the
        // same time cannot both read the same max(order).
        const question = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Quiz" WHERE "id" = ${quizId as string} FOR UPDATE`;

            const last = await tx.question.aggregate({
                where: { quizId: quizId as string },
                _max: { order: true }
            });

            return tx.question.create({
                data: {
                    text,
                    timeLimit,
                    order: (last._max.order ?? 0) + 1,
                    difficulty,
                    quizId: quizId as string,
                    answers: {
                        create: answers.map((answer) => ({
                            text: answer.text,
                            isCorrect: answer.isCorrect
                        }))
                    }
                },
                include: {
                    answers: true
                }
            });
        });

        return res.status(201).json(question);

    } catch (error) {
        console.log("Create question error: ", error);
        return errorResponse(res, 500, "Internal Server Error")
    }
}







export const startQuizSessionController = async (req: Request, res: Response) => {
    try {
        const quizId = req.params.quizId;

        const isOrganozer = await prisma.quizOrganizer.findFirst({
            where: {
                quizId: quizId as string,
                userId: req.userId,
                inviteStatus: 'ACCEPTED'
            }
        });

        if (!isOrganozer) return errorResponse(res, 403, "You don't have access to this quiz");

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId as string },
            include: {
                quizSessions: {
                    where: { status: 'WAITING' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!quiz) return errorResponse(res, 404, "Quiz not found");

        if (quiz.status !== 'ACTIVE') return errorResponse(res, 400, "Quiz is not active. Please generate access code first");

        const liveVideo = req.body?.liveVideo === true;

        let session: typeof quiz.quizSessions[number] | undefined = quiz.quizSessions[0];

        // The lobby already open was set up for the other mode. Players who
        // joined it were told whether there is video, and a live video lobby
        // may hold more than an ordinary one allows, so it cannot be switched
        // under them. An empty lobby is replaced instead of updated: ws-server
        // caches the session row, and a fresh id cannot be served stale.
        if (session && session.liveVideo !== liveVideo) {
            const joined = await prisma.participant.count({ where: { sessionId: session.id } });

            if (joined > 0) {
                return errorResponse(
                    res,
                    409,
                    `Players have already joined this lobby ${session.liveVideo ? 'with' : 'without'} live video. Host it the same way, or wait until it ends.`
                );
            }

            await prisma.quizSession.update({
                where: { id: session.id },
                data: { status: 'CANCELLED', endedAt: new Date() }
            });
            session = undefined;
        }

        if (!session) {
            session = await prisma.quizSession.create({
                data: {
                    quizId: quizId as string,
                    status: 'WAITING',
                    liveVideo
                }
            })
        }

        return res.status(200).json({
            sessonId: session.id,
            liveVideo: session.liveVideo,
        });

    } catch (error) {
        console.log("Start quiz session error: ", error);
        return errorResponse(res, 500, "Internal Server Error")

    }
}






// deleting question from a quiz
export const deleteQuestionController = async (req: Request, res: Response) => {
    try {
        const { quizId, questionId } = req.params;

        if (!questionId || typeof questionId !== 'string' || !questionId.trim()) {
            return errorResponse(res, 400, "Question ID is required");
        }

        const question = await prisma.question.findUnique({
            where: { id: questionId as string },
            include: {
                quiz: {
                    include: {
                        quizOrganizers: {
                            where: {
                                userId: req.userId,
                                inviteStatus: 'ACCEPTED'
                            }
                        }
                    }
                }
            }
        });

        if (!question) {
            return errorResponse(res, 404, "Question not found");
        }

        if (quizId && question.quizId !== quizId) {
            return errorResponse(res, 404, "Question not found in this quiz");
        }

        const isOrganizer = question.quiz.quizOrganizers.length > 0;
        const isCreator = question.quiz.creatorId === req.userId;

        if (!isOrganizer && !isCreator) {
            return errorResponse(res, 403, "You don't have access to this quiz");
        }

        // Same quiz lock as createQuestionController, then close the gap so
        // the orders stay 1..n and the next question does not tie with one.
        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Quiz" WHERE "id" = ${question.quizId} FOR UPDATE`;

            await tx.question.delete({
                where: { id: questionId as string }
            });

            const remaining = await tx.question.findMany({
                where: { quizId: question.quizId },
                select: { id: true, order: true }
            });

            for (const { id, order } of renumberQuestions(remaining)) {
                await tx.question.update({ where: { id }, data: { order } });
            }
        });

        return res.status(200).json({
            success: true,
            message: "Question deleted successfully"
        });

    } catch (error) {
        console.log("Delete question error: ", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
}




/**
 * Thrown inside the update transaction so the rollback happens, then turned
 * into a 409 by the handler below.
 */
class QuestionAlreadyPlayed extends Error {
    constructor() {
        super("Question already played");
        this.name = "QuestionAlreadyPlayed";
    }
}


export const updateQuestionController = async (
    req: Request,
    res: Response
) => {
    try {
        const userId = req.userId;
        const quizId = req.params.quizId as string;
        const questionId = req.params.questionId as string;

        if (!userId) {
            return errorResponse(res, 401, "Unauthorized");
        }

        if (!questionId || !questionId.trim()) {
            return errorResponse(res, 400, "Question ID is required");
        }

        const parsedData = parseCreateQuestion(req.body);
        if (!parsedData.ok) {
            return errorResponse(res, 400, parsedData.error);
        }

        const { text, timeLimit, answers, difficulty } = parsedData.data;

        const question = await prisma.question.findUnique({
            where: {
                id: questionId
            },
            include: {
                quiz: {
                    include: {
                        quizOrganizers: {
                            where: {
                                userId,
                                inviteStatus: "ACCEPTED"
                            }
                        }
                    }
                }
            }
        });

        if (!question) {
            return errorResponse(res, 404, "Question not found");
        }

        if (question.quizId !== quizId) {
            return errorResponse(res, 404, "Question not found in this quiz");
        }

        const isOrganizer = question.quiz.quizOrganizers.length > 0;
        const isCreator = question.quiz.creatorId === userId;

        if (!isOrganizer && !isCreator) {
            return errorResponse(res, 403, "You don't have access to this quiz");
        }

        const updatedQuestion = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Quiz" WHERE "id" = ${question.quizId} FOR UPDATE`;

            // Editing replaces the answer rows, and ParticipantAnswer.answerId
            // is SET NULL on delete, so every past player would quietly lose
            // the record of which option they chose. A reconnecting player's
            // selected answer is restored from that column too. Checked inside
            // the transaction, after the row lock, so a quiz that starts
            // between the check and the write cannot slip through.
            const playedCount = await tx.participantAnswer.count({
                where: { questionId: question.id }
            });

            if (playedCount > 0) {
                throw new QuestionAlreadyPlayed();
            }

await tx.question.update({
    where: {
        id: question.id
    },
    data: {
        text,
        timeLimit,
        difficulty
    }
});

await tx.answer.deleteMany({
    where: {
        questionId: question.id
    }
});

await tx.answer.createMany({
    data: answers.map((answer) => ({
        questionId: question.id,
        text: answer.text,
        isCorrect: answer.isCorrect
    }))
});

return await tx.question.findUnique({
    where: {
        id: question.id
    },
    include: {
        answers: true
    }
});
        });

        return res.status(200).json(updatedQuestion);
    } catch (error) {
        if (error instanceof QuestionAlreadyPlayed) {
            return errorResponse(
                res,
                409,
                "This question has already been answered by players and can no longer be edited."
            );
        }

        console.log("Update question error: ", error);
        return errorResponse(res, 500, "Internal Server Error");
    }
};