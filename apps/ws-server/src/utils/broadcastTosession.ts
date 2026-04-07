import { clients } from "../clients/index.js";


export function broadcastToSession(sessionId: string, type: string, payload: any = {}) {
    const message = JSON.stringify({ type, payload });
    for (const client of clients) {
        if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
        }
    }
}
