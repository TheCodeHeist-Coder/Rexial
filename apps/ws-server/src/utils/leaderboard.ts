import { getCachedLeaderboard } from "./cache.js";


export async function getLeaderboard(sessionId: string) {
    return getCachedLeaderboard(sessionId);

}