import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from '@repo/db';

const wss = new WebSocketServer({ port: 8080 });



wss.on('connection', (ws: WebSocket) => {

    ws.on('message', async (message: string) => {
        try {
            const data = JSON.parse(message);

        } catch (error) {
            console.log('WS Error', error)
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    })
})