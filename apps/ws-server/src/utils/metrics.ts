import { createServer } from "node:http";

const questionCloseLatencyBuckets = [
    0.01,
    0.025,
    0.05,
    0.1,
    0.25,
    0.5,
    1,
    2.5,
    5,
].map((upperBound) => ({ upperBound, count: 0 }));

let answersSubmitted = 0;
let answersPersisted = 0;
let answerQueueFlushFailures = 0;
let answerQueueTransactionErrors = 0;
let questionCloseLatencyCount = 0;
let questionCloseLatencySum = 0;

export function recordAnswerSubmitted() {
    answersSubmitted++;
}

export function recordAnswersPersisted(count: number) {
    answersPersisted += count;
}

export function recordAnswerQueueFlushFailure() {
    answerQueueFlushFailures++;
}

export function recordAnswerQueueTransactionError() {
    answerQueueTransactionErrors++;
}

export function observeQuestionCloseLatency(seconds: number) {
    questionCloseLatencyCount++;
    questionCloseLatencySum += seconds;
    for (const bucket of questionCloseLatencyBuckets) {
        if (seconds <= bucket.upperBound) bucket.count++;
    }
}

export function renderMetrics(openConnections: number, sessionsInProgress: number): string {
    const lines = [
        "# HELP rexial_ws_connections_open Current open WebSocket connections.",
        "# TYPE rexial_ws_connections_open gauge",
        `rexial_ws_connections_open ${openConnections}`,
        "# HELP rexial_ws_sessions_in_progress Sessions with a running question timer on this instance.",
        "# TYPE rexial_ws_sessions_in_progress gauge",
        `rexial_ws_sessions_in_progress ${sessionsInProgress}`,
        "# HELP rexial_ws_answers_submitted_total Answers accepted into the in-memory queue.",
        "# TYPE rexial_ws_answers_submitted_total counter",
        `rexial_ws_answers_submitted_total ${answersSubmitted}`,
        "# HELP rexial_ws_answers_persisted_total Answers inserted into the database.",
        "# TYPE rexial_ws_answers_persisted_total counter",
        `rexial_ws_answers_persisted_total ${answersPersisted}`,
        "# HELP rexial_ws_answer_queue_flush_failures_total Answer queue flush attempts that failed.",
        "# TYPE rexial_ws_answer_queue_flush_failures_total counter",
        `rexial_ws_answer_queue_flush_failures_total ${answerQueueFlushFailures}`,
        "# HELP rexial_ws_answer_queue_transaction_errors_total Answer score transactions that failed.",
        "# TYPE rexial_ws_answer_queue_transaction_errors_total counter",
        `rexial_ws_answer_queue_transaction_errors_total ${answerQueueTransactionErrors}`,
        "# HELP rexial_ws_question_close_latency_seconds Time from the question deadline to results broadcast.",
        "# TYPE rexial_ws_question_close_latency_seconds histogram",
    ];

    questionCloseLatencyBuckets.forEach(({ upperBound, count }) => {
        lines.push(
            `rexial_ws_question_close_latency_seconds_bucket{le="${upperBound}"} ${count}`,
        );
    });
    lines.push(
        `rexial_ws_question_close_latency_seconds_bucket{le="+Inf"} ${questionCloseLatencyCount}`,
        `rexial_ws_question_close_latency_seconds_sum ${questionCloseLatencySum}`,
        `rexial_ws_question_close_latency_seconds_count ${questionCloseLatencyCount}`,
    );

    return `${lines.join("\n")}\n`;
}

export function createMetricsServer(getGauges: () => {
    openConnections: number;
    sessionsInProgress: number;
}) {
    return createServer((request, response) => {
        if (request.url?.split("?")[0] !== "/metrics") {
            response.writeHead(404).end();
            return;
        }
        if (request.method !== "GET") {
            response.writeHead(405, { Allow: "GET" }).end();
            return;
        }

        const { openConnections, sessionsInProgress } = getGauges();
        response.writeHead(200, {
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        });
        response.end(renderMetrics(openConnections, sessionsInProgress));
    });
}
