import type { Client } from "../index.js";



export const clients = new Set<Client>();
export const sessionTimers = new Map<string, NodeJS.Timeout>();

// Clients grouped by session, so a broadcast touches only the people in that
// quiz instead of scanning every connection. With several quizzes running at
// once the flat Set means each tick walks all of them; this keeps the work
// proportional to one session.
const bySession = new Map<string, Set<Client>>();

/** Clients in one session. Empty set if the session has none. */
export function clientsInSession(sessionId: string): ReadonlySet<Client> {
    return bySession.get(sessionId) ?? EMPTY;
}
const EMPTY: ReadonlySet<Client> = new Set();

/** Register a client under a session, moving it off any previous one. */
export function indexClient(client: Client, sessionId: string) {
    if (client.sessionId && client.sessionId !== sessionId) {
        unindexClient(client);
    }

    let group = bySession.get(sessionId);
    if (!group) {
        group = new Set();
        bySession.set(sessionId, group);
    }
    group.add(client);
}

/** Remove a client from its session group, dropping the group when empty. */
export function unindexClient(client: Client) {
    const group = bySession.get(client.sessionId);
    if (!group) return;

    group.delete(client);
    if (group.size === 0) bySession.delete(client.sessionId);
}
