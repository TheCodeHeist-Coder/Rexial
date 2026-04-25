import { prisma } from "@repo/db";
import { clearSessionCache } from "./cache.js";

export async function endQuizSession(sessionId: string) {
    // Mark session as completed
    const session = await prisma.quizSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
        include: { quiz: true }
    });

    // Clear join code and set quiz to COMPLETED so no one can join again
    await prisma.quiz.update({
        where: { id: session.quizId },
        data: { joinCode: null, status: 'COMPLETED' }
    });

    await clearSessionCache(sessionId);
}
