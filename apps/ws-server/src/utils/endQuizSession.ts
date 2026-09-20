import { prisma } from "@repo/db";
import { clearSessionCache } from "./cache.js";

export async function endQuizSession(sessionId: string) {
    // Both writes go together: if the second failed on its own, the session
    // would read COMPLETED while the quiz still carried a live joinCode, and
    // people could keep joining a quiz that had already finished.
    await prisma.$transaction(async (tx) => {
        // Mark session as completed
        const session = await tx.quizSession.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED', endedAt: new Date() },
            include: { quiz: true }
        });

        // Clear join code and set quiz to COMPLETED so no one can join again
        await tx.quiz.update({
            where: { id: session.quizId },
            data: { joinCode: null, status: 'COMPLETED' }
        });
    });

    await clearSessionCache(sessionId);
}
