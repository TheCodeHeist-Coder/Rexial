import { WebSocketServer, WebSocket } from 'ws';
import { prisma } from '@repo/db';


interface Client {
    ws: WebSocket;
    sessionId: string;
    role: 'ORGANIZER' | 'PARTICIPANT';
    participantId?: string;
    userId?: string;
}

const wss = new WebSocketServer({ port: 8080 });


const clients = new Set<Client>();
const sessionTimers = new Map<string, NodeJS.Timeout>();

wss.on('connection', (ws: WebSocket) => {

    const client: Client = {
        ws,
        sessionId: '',
        role: 'PARTICIPANT'
    };
    clients.add(client);


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



const handleMessage = async (client: Client, data: any) => {
    const { type, payload } = data;

    switch (type) {
        case 'join': {
            const { sessionId, role, participantId, userId } = payload;
            client.sessionId = sessionId;
            client.role = role;
            client.participantId = participantId;
            client.userId = userId;

            if (role === 'ORGANIZER') {
                const participants = await prisma.participant.findMany({
                    where: { sessionId }
                });

                client.ws.send(JSON.stringify({
                    type: 'participants',
                    payload: { participants }
                }));
            } else if (role === 'PARTICIPANT' && participantId) {
                const participant = await prisma.participant.findUnique({
                    where: { id: participantId }
                });

                broadcastToSession(sessionId, 'participant:joined', { participant });
            }
            break;
        }



        case 'quiz:start': {
            const { sessionId } = payload;
            await prisma.quizSession.update({
                where: { id: sessionId },
                data: { status: 'IN_PROGRESS', startedAt: new Date() }
            });
            broadcastToSession(sessionId, 'quiz:start');
            break;
        }

        case 'quiz:next-question': {
            const { sessionId, questionIndex = 0 } = payload;

            const session = await prisma.quizSession.findUnique({
                where: { id: sessionId },
                include: {
                    quiz: {
                        include: {
                            questions: {
                                orderBy: { order: 'desc' },
                                include: { answers: true }
                            }
                        }
                    }
                }
            })

            if(!sessionId || !session?.quiz.questions[questionIndex]){
                // now no more question- end quiz and clean up
               await endQuizSession(sessionId);
               broadcastToSession(sessionId, 'quiz:ended');
               return;    
            };
        }






    }
}






function broadcastToSession(sessionId: string, type: string, payload: any = {}) {
    const message = JSON.stringify({ type, payload });
    for (const client of clients) {
        if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
        }
    }
}



async function endQuizSession(sessionId: string) {
  // Mark session as completed
  const session = await prisma.quizSession.update({
    where: { id: sessionId },
    data: { status: 'COMPLETED', endedAt: new Date() },
    include: { quiz: true }
  });

  // Clear join code and set quiz to COMPLETED so no one can join again
  await prisma.quiz.update({
    where: { id: session.quizId },
    data: { joinCode: null, status: 'COMPLETED' }
  });
}


