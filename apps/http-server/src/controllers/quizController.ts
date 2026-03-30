import { Request, Response } from 'express';
import { errorResponse } from '../utils/error';
import { prisma } from '@repo/db';
import { generateCode } from '../utils/code';

export const createQuizController = async (req: Request, res: Response) => {
    try {

        const { title, description } = req.body;

        if (!title || !description) return errorResponse(res, 400, "Title and description are required");

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
                }
            },
            orderBy: { createdAt: 'desc' }

        });


        return res.status(200).json({
            organizedQuizes,
            participated: participatedQuizes
        })

    } catch (error) {
        console.log("Get all quizes error: ", error);
        return errorResponse(res, 500, "Internal Srever Erorr")
    }
}




// getting quiz by id
export const getQuizByIdController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const quiz = await prisma.quiz.findFirst({
            where: {
                id: id as string,
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

        const { id } = req.params;

        const isOrganizer = await prisma.quizOrganizer.findFirst({
            where: {
                quizId: id as string,
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
                        id: id as string
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
        const { text, timeLimit, asnwers } = req.body;

        if (!text || !timeLimit || !asnwers) return errorResponse(res, 400, "Text, time limit and answers are required")

        const isOrganizer = await prisma.quizOrganizer.findFirst({
            where: {
                quizId: quizId as string,
                userId: req.userId,
                inviteStatus: 'ACCEPTED'
            }
        })

        if (!isOrganizer) return errorResponse(res, 403, "You don't have access to this quiz");

        const totalQuestions = await prisma.question.count({
            where: {
                quizId: quizId as string
            }
        });


        const question = await prisma.question.create({
            data: {
                text,
                timeLimit: timeLimit || 15,
                order: totalQuestions + 1,
                quizId: quizId as string,
                answers: {
                    create: asnwers.map((answer: any) => ({
                        text: answer.text,
                        isCorrect: answer.isCorrect
                    }))
                }
            },
            include: {
                answers: true
            }
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

        let session = quiz.quizSessions[0];
        if (!session) {
            session = await prisma.quizSession.create({
                data: {
                    quizId: quizId as string,
                    status: 'WAITING'
                }
            })
        }

        return res.status(200).json({
            sessonId: session.id,
        });

    } catch (error) {
        console.log("Start quiz session error: ", error);
        return errorResponse(res, 500, "Internal Server Error")

    }
}