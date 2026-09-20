import { cache } from "../redis.js";
import { prisma } from "@repo/db";


const TTL = {
    SESSION: 60 * 60, // 1 hour
    PARTICIPANT: 60 * 30, // 1 hour
    QUESTIONS: 60 * 60 * 4, // 4 hour
    LEADERBOARD: 10
}


// key helpers
export const Keys = {
    session: (sessionId: string) => `quiz:session:${sessionId}`,
    participant: (participantId: string) => `quiz:participant:${participantId}`,
    questions: (sessionId: string) => `quiz:questions:${sessionId}`,
    leaderboard: (sessionId: string) => `quiz:leaderboard:${sessionId}`
}


async function readThrough<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
): Promise<T> {
    const cached = await cache.get(key);
    if (cached) {
        return JSON.parse(cached) as T;
    }

    const fresh = await fetchFn();
    if (fresh !== null) {
        await cache.setex(key, ttl, JSON.stringify(fresh));
    }

    return fresh;
}



//! caching quiz with quiz-session
export const getCachedSession = (sessionId: string) => {
    return readThrough(
        Keys.session(sessionId),
        TTL.SESSION,
        () => prisma.quizSession.findUnique(
            {
                where:{ id: sessionId },
                include: {quiz: true},

            }),
    );
}


//! caching all questions with answer
export const getCachedQuestions = (sessionId: string) => {

    return readThrough(
        Keys.questions(sessionId),
        TTL.QUESTIONS,
        async () => {
            const session = await prisma.quizSession.findUnique({
                where: {id: sessionId},
                include: {
                    quiz: {
                        include :{
                            questions: {
                                orderBy: {order: 'asc'},
                                include: {answers: true}
                            }
                        }
                    }
                }
            });
            return session?.quiz.questions || [];
        }
    );
           
}

//! live participant list for a session 

export const getCachedParticipants = (sessionId: string) => {
    return readThrough(
        Keys.participant(sessionId),
        TTL.PARTICIPANT,
        () => prisma.participant.findMany({
            where: {
                sessionId
            }
        })
    )
};



// delete participant list cache for a session
export const invalidateParticipants = async(sessionId: string) => {
      await cache.del(Keys.participant(sessionId));
}


/**
 * Add one participant to the cached list, returning the updated list.
 *
 * Joining used to invalidate the cache and immediately rebuild it, so every
 * join re-read the whole participant table: 300 people joining one session
 * meant ~45,000 rows read. Appending keeps the cache warm through the join
 * rush instead.
 *
 * Falls back to a normal read-through when the cache is cold or unreadable,
 * so a Redis hiccup degrades to the old behaviour rather than losing anyone.
 */
export const appendCachedParticipant = async (sessionId: string, participant: any) => {
    const key = Keys.participant(sessionId);

    let cached: any[] | null = null;
    try {
        const raw = await cache.get(key);
        if (raw) cached = JSON.parse(raw);
    } catch {
        cached = null;
    }

    if (!Array.isArray(cached)) {
        // Cold cache: read through, which now includes this participant since
        // the row is already committed by the time we are called.
        return getCachedParticipants(sessionId);
    }

    // A reconnect re-joins with an id already in the list.
    if (!cached.some((p) => p?.id === participant?.id)) {
        cached.push(participant);
    }

    await cache.setex(key, TTL.PARTICIPANT, JSON.stringify(cached));
    return cached;
}


// get cached leaderboard for a session
export async function getCachedLeaderboard(sessionId: string) {
    return readThrough(
        Keys.leaderboard(sessionId),
        TTL.LEADERBOARD,
        () => prisma.participant.findMany({
            where: { sessionId },
            orderBy: { score: 'desc' },
            select: { id: true, username: true, score: true },
        }),
    );
}


export async function invalidateLeaderboard(sessionId: string) {
    await cache.del(Keys.leaderboard(sessionId));
}



// remove all cached data for  a session when it ends....
export async function clearSessionCache(sessionId: string) {
    await cache.del(
        Keys.session(sessionId),
        Keys.questions(sessionId),
        Keys.participant(sessionId),
        Keys.leaderboard(sessionId),
    );
}
