import { configDotenv } from 'dotenv';
configDotenv();
import WebSocket, { WebSocketServer } from 'ws';

import { clients, unindexClient } from './clients/index.js';
import { handleMessage } from './utils/handleMessages.js';
import { startSessionSubscriber } from './utils/broadcastTosession.js';
import { invalidateParticipants } from './utils/cache.js';




const wss = new WebSocketServer({ port: 8080 });



export interface Client {
    ws: WebSocket;
    sessionId: string;
    role: 'ORGANIZER' | 'PARTICIPANT';
    participantId?: string;
    userId?: string;
    isAlive: boolean;
}

// A dropped connection (NAT timeout, closed laptop, proxy cutting an idle
// socket) often never fires 'close', so the client would linger in `clients`
// forever and keep inflating participant counts. Ping every 30s and drop
// anything that has not ponged since the previous round.
const HEARTBEAT_INTERVAL_MS = 30_000;

const heartbeat = setInterval(() => {
    for (const client of clients) {
        if (!client.isAlive) {
            client.ws.terminate();   // fires 'close' -> normal cleanup path
            continue;
        }

        client.isAlive = false;
        client.ws.ping();
    }
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => clearInterval(heartbeat));


startSessionSubscriber();

wss.on('connection', (ws: WebSocket) => {


    const client: Client = {
        ws,
        sessionId: '',
        role: 'PARTICIPANT',
        isAlive: true
    };
    clients.add(client);

    // Browsers answer a protocol-level ping automatically, so this needs no
    // client-side support.
    ws.on('pong', () => {
        client.isAlive = true;
    });


    ws.on('message', async (message) => {
        try {
            const parsedMessage = message.toString();

            console.log("Raw Message", parsedMessage)

            const data = JSON.parse(parsedMessage);

            await handleMessage(client, data);


        } catch (error) {
            console.log('WS Error', error)
        }
    });

    ws.on('close', async () => {

        console.log('Client disconnected...', client.participantId ?? 'unknown participant');
        clients.delete(client);
        unindexClient(client);

        if (client.sessionId && client.role === 'PARTICIPANT') {
            await invalidateParticipants(client.sessionId);
        }

    })
})









