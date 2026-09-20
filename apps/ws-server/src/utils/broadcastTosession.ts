import WebSocket from "ws";
import { clientsInSession } from "../clients/index.js";
import { pub, sub, sessionChannel } from "../redis.js";
import {randomUUID} from 'crypto';


const SERVER_ID = randomUUID();


export function broadcastToSession(sessionId: string, type: string, payload: any = {}) {
  const envelope = JSON.stringify({ type, payload, _sid: SERVER_ID });

  // Serialise once for the whole session rather than per recipient: the
  // timer ticks once a second per live quiz, so this runs on every tick for
  // every participant.
  const outbound = JSON.stringify({ type, payload });

  for (const client of clientsInSession(sessionId)) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(outbound);
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

        for (const client of clientsInSession(sessionId)) {
            if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(outbound);
            }
        }
    });
}
