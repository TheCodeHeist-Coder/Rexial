
import { prisma } from "@repo/db";
import { Request, Response } from "express";
import { errorResponse } from "../utils/error";
import { string } from "zod";

// logic for joining a quiz session
export const joinQuizController = async (req: Request, res: Response) => {

    try {

        const { code, username } = req.body;

        // validate input
        if (!code || !username) {
            return res.status(400).json({ message: "Code and username are required" });
        }

        const quiz = await prisma.quiz.findUnique({
            where: {
                joinCode: code
            },
            include: {
                quizSessions: {
                    where: { status: 'WAITING' },
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!quiz) {
            return errorResponse(res, 404, "Quiz not found");
        };

        if (quiz.status !== 'ACTIVE') {
            return errorResponse(res, 400, 'Quiz is not active...')
        }


        // find and create a session
        let session = quiz.quizSessions[0];

        if (!session) {
            session = await prisma.quizSession.create({
                data: {
                    quizId: quiz.id,
                    status: 'WAITING'
                }
            });
        }


        // create participnats
        const participant = await prisma.participant.create({
            data: {
                username,
                sessionId: session.id,
                userId: req.userId || null
            }
        });

        return res.status(200).json({
            sessionId: session.id,
            participantId: participant.id,
            quizTitle: quiz.title
        });


    } catch (error) {
        console.log("Error joining quiz session:", error);
        return errorResponse(res, 500, "Internal server error");
    }

}



// logic for getting leaderboard

export const getLeaderboardController = async (req: Request, res: Response) => {
    try {

        const sessionId = req.params.sessionId;

        const participants = await prisma.participant.findMany({
            where: { sessionId: sessionId as string },
            orderBy: { score: 'desc' },
            select: {
                id: true,
                username: true,
                score: true
            }
        });

        return res.status(200).json(participants)

    } catch (error) {
        console.log("error while getting dashboard", error)
        return errorResponse(res, 500, 'Internal server error');
    }
}