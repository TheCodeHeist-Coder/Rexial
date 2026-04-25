import WebSocket from "ws";
import { clients } from "../clients/index.js";
import { pub, sub, sessionChannel } from "../redis.js";
import {randomUUID} from 'crypto';


const SERVER_ID = randomUUID();


export function broadcastToSession(sessionId: string, type: string, payload: any = {}) {
  const envelope = JSON.stringify({ type, payload, _sid: SERVER_ID });

  for(const client of clients) {
    if(client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type, payload }));
    }
  }

  pub.publish(sessionChannel(sessionId), envelope).catch((err) => {
    console.error(`failed to publish message to session ${sessionId}:`, err);
  });
}


export function startSessionSubscriber() {
    sub.psubscribe('session:*', (err) => {
        if (err) console.error('[Redis sub] psubscribe failed', err);
    });

    sub.on('pmessage', (_pattern: string, channel: string, raw: string) => {
        const { _sid, ...message } = JSON.parse(raw);

        // Drop messages we published ourselves — local clients already got them
        if (_sid === SERVER_ID) return;

        const sessionId = channel.replace('session:', '');
        const outbound = JSON.stringify(message);

        for (const client of clients) {
            if (
                client.sessionId === sessionId &&
                client.ws.readyState === WebSocket.OPEN
            ) {
                client.ws.send(outbound);
            }
        }
    });
}
