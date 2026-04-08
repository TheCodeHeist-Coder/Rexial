import WebSocket, { WebSocketServer } from 'ws';
import { clients } from './clients/index.js';
import { handleMessage } from './utils/handleMessages.js';





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
            
            await handleMessage(client,data);
                

        } catch (error) {
            console.log('WS Error', error)
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    })
})









