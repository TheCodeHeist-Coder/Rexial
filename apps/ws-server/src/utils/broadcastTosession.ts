import WebSocket from "ws";
import { clients } from "../clients/index.js";
import { pub, sub, sessionChannel } from "../redis.js";


export function broadcastToSession(sessionId: string, type: string, payload: any = {}) {
  const message = JSON.stringify({ type, payload });


  pub.publish(sessionChannel(sessionId), message).catch((err) => {
    console.error(`failed to publish message to session ${sessionId}:`, err);
  });
}

export function startSessionSubscriber() {
  sub.subscribe('session:*', (error) => {
    if (error) {
      console.error('failed to subscribe to session channel:', error);
    } else {
      console.log('subscribed to session channel');
    }
  });

  sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
    const sessionId = channel.replace('session:', '');

    for (const client of clients) {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  });
}
