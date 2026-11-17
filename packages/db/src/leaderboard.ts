import { prisma } from "./client.js";

export type RankedParticipant = {
  id: string;
  sessionId: string;
  username: string;
  score: number;
  totalTimeMs: number;
};

export async function getRankedParticipants(sessionIds: string[]) {
  if (sessionIds.length === 0) return [];

  return prisma.$queryRaw<RankedParticipant[]>`
    SELECT p.id,
           p."sessionId",
           p.username,
           p.score,
           COALESCE(SUM(pa."timeMs"), 0)::int AS "totalTimeMs"
    FROM "Participant" p
    LEFT JOIN "ParticipantAnswer" pa ON pa."participantId" = p.id
    WHERE p."sessionId" = ANY(${sessionIds})
    GROUP BY p.id, p."sessionId", p.username, p.score
    ORDER BY p."sessionId" ASC, p.score DESC, "totalTimeMs" ASC, p.username ASC
  `;
}
