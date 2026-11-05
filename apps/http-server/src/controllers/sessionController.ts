
import { prisma } from "@repo/db";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { errorResponse } from "../utils/error";
import { parseJoinQuiz } from "../utils/quizInput";
import { string } from "zod";

/**
 * Most players a live video session takes.
 *
 * Every viewer pulls the host's video from the media server, so its upload
 * grows with the room; past this a single VPS cannot keep up. apps/streaming
 * sizes the LiveKit room from the same number.
 */
export const MAX_LIVE_VIDEO_PARTICIPANTS = 300;

/** Thrown inside the join transaction when a live video session is full. */
class SessionFullError extends Error {}

// logic for joining a quiz session
export const joinQuizController = async (req: Request, res: Response) => {

    try {

        // validate input
        const parsed = parseJoinQuiz(req.body);
        if (!parsed.ok) return errorResponse(res, 400, parsed.error);

        const { code, username } = parsed.data;

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


        // Session lookup/creation and the participant insert go together: on
        // their own, a failed participant insert would leave an empty session
        // behind for the quiz.
        const { session, participant } = await prisma.$transaction(async (tx) => {
            // Re-read inside the transaction rather than trusting the earlier
            // read: at 500 simultaneous joins many requests see no session at
            // once, and each would otherwise create its own.
            let session = quiz.quizSessions[0]
                ?? await tx.quizSession.findFirst({
                    where: { quizId: quiz.id, status: { in: ['WAITING', 'IN_PROGRESS'] } },
                });

            if (!session) {
                session = await tx.quizSession.create({
                    data: {
                        quizId: quiz.id,
                        status: 'WAITING'
                    }
                });
            }

            if (session.liveVideo) {
                // Lock the session row so concurrent joins count one at a
                // time; without it, a rush at 299 would let several through.
                await tx.$queryRaw`SELECT id FROM "QuizSession" WHERE id = ${session.id} FOR UPDATE`;

                const joined = await tx.participant.count({ where: { sessionId: session.id } });
                if (joined >= MAX_LIVE_VIDEO_PARTICIPANTS) throw new SessionFullError();
            }

            // create participnats
            const participant = await tx.participant.create({
                data: {
                    username,
                    sessionId: session.id,
                    userId: req.userId || null
                }
            });

            return { session, participant };
        });

        // Participant ids are not secret: the leaderboard and the lobby show
        // them to everyone. This token is what proves a player is the one who
        // joined, so apps/streaming can tell who may raise a hand or speak.
        const participantToken = jwt.sign(
            { participantId: participant.id, sessionId: session.id },
            process.env.JWT_SECRET || "secret",
            { expiresIn: '1d' }
        );

        return res.status(200).json({
            sessionId: session.id,
            participantId: participant.id,
            participantToken,
            quizTitle: quiz.title,
            liveVideo: session.liveVideo
        });


    } catch (error) {
        if (error instanceof SessionFullError) {
            return errorResponse(res, 403, `This live video quiz is full (${MAX_LIVE_VIDEO_PARTICIPANTS} players).`);
        }
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