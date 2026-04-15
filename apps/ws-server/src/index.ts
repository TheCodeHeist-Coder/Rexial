import WebSocket, { WebSocketServer } from 'ws';
import { clients } from './clients/index.js';
import { handleMessage } from './utils/handleMessages.js';
import { prisma } from '@repo/db';
import { broadcastToSession } from './utils/broadcastTosession.js';





const wss = new WebSocketServer({ port: 8080 });



export interface Client {
    ws: WebSocket;
    sessionId: string;
    role: 'ORGANIZER' | 'PARTICIPANT';
    participantId?: string;
    userId?: string;
}




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

        clients.delete(client);


        setTimeout(async () => {

            const stillConnected = [...clients].some(c => c.participantId === client.participantId && c.ws.readyState === WebSocket.OPEN);

            if (!stillConnected && client.participantId) {


                await prisma.participant.delete({
                    where: { id: client.participantId }
                });

                const participants = await prisma.participant.findMany({
                    where: { sessionId: client.sessionId }
                });

                broadcastToSession(client.sessionId, 'participants:sync', { participants });

            }



        }, 30000)



        
      



    })
})









