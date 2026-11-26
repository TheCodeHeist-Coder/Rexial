import { configDotenv } from 'dotenv';
configDotenv();
import WebSocket, { WebSocketServer } from 'ws';

import { clients, sessionTimers, unindexClient } from './clients/index.js';
import { handleMessage } from './utils/handleMessages.js';
import { startSessionSubscriber } from './utils/broadcastTosession.js';
import { invalidateParticipants } from './utils/cache.js';
import { drainAll } from './utils/answerQueue.js';
import { createMetricsServer } from './utils/metrics.js';
import { markSessionDisconnected, startPollReaper } from './utils/pollReaper.js';



const wss = new WebSocketServer({ port: 8080 });
const metricsPort = Number(process.env.METRICS_PORT ?? 9090);
if (!Number.isInteger(metricsPort) || metricsPort < 1 || metricsPort > 65535) {
    throw new Error('METRICS_PORT must be an integer between 1 and 65535');
}
const metricsHost = process.env.METRICS_HOST ?? '127.0.0.1';
const metricsServer = createMetricsServer(() => ({
    openConnections: clients.size,
    sessionsInProgress: sessionTimers.size,
}));
metricsServer.on('error', (err) => {
    console.error('[metrics] server failed', err);
});
metricsServer.listen(metricsPort, metricsHost, () => {
    console.log(`[metrics] listening on ${metricsHost}:${metricsPort}`);
});



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

wss.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(pollReaper);
});


/**
 * Write buffered answers before the process goes away.
 *
 * Answers are batched in memory for a fraction of a second before they are
 * written, so a deploy or restart landing in that window would drop whatever
 * was waiting — during a live question, that is real answers from real
 * people. Docker sends SIGTERM and waits ten seconds before killing, which is
 * ample for a flush.
 */
let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log(`[shutdown] ${signal} received, flushing buffered answers`);
        clearInterval(heartbeat);
        clearInterval(pollReaper);

        try {
            await drainAll();
            console.log('[shutdown] answers flushed');
        } catch (err) {
            console.error('[shutdown] flush failed', err);
        }

        metricsServer.close();
        wss.close(() => process.exit(0));
        // Do not hang on a socket that will not close.
        setTimeout(() => process.exit(0), 5_000).unref();
    });
}


// Last line of defence. Node 22 exits on an unhandled rejection, which drops
// every quiz on this instance and skips the shutdown flush above, so log it
// and keep serving. Call sites should still catch their own errors; this is
// only for the one that slips through.
process.on('unhandledRejection', (reason) => {
    console.error('[process] unhandled rejection', reason);
});


startSessionSubscriber();
const pollReaper = startPollReaper();

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

        if (client.sessionId) {
            markSessionDisconnected(client.sessionId);
        }

        if (client.sessionId && client.role === 'PARTICIPANT') {
            // ws does not await this handler, so a Redis error here would
            // otherwise surface as an unhandled rejection.
            try {
                await invalidateParticipants(client.sessionId);
            } catch (err) {
                console.error('[ws] participant cache invalidation failed', client.sessionId, err);
            }
        }

    })
})









