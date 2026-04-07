import { prisma } from "@repo/db";




export async function getLeaderboard(sessionId: string) {
    return await prisma.participant.findMany({
        where: { sessionId },
        orderBy: { score: 'desc' },
        select: { id: true, username: true, score: true }
    });

}