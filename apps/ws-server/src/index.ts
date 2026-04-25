import WebSocket, { WebSocketServer } from 'ws';
import { clients } from './clients/index.js';
import { handleMessage } from './utils/handleMessages.js';
import { prisma } from '@repo/db';
import { broadcastToSession } from './utils/broadcastTosession.js';

import { startSessionSubscriber } from './utils/broadcastTosession.js';
import { invalidateParticipants } from './utils/cache.js';



const wss = new WebSocketServer({ port: 8080 });



export interface Client {
    ws: WebSocket;
    sessionId: string;
    role: 'ORGANIZER' | 'PARTICIPANT';
    participantId?: string;
    userId?: string;
}


startSessionSubscriber();

wss.on('connection', (ws: WebSocket) => {


    const client: Client = {
        ws,
        sessionId: '',
        role: 'PARTICIPANT'
    };
    clients.add(client);


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

        if (client.sessionId && client.role === 'PARTICIPANT') {
            await invalidateParticipants(client.sessionId);
        }

    })
})









