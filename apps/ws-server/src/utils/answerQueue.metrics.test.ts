import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createManyAndReturn: vi.fn(),
    transaction: vi.fn(),
    updateMany: vi.fn(),
}));

vi.mock("@repo/db", () => ({
    prisma: {
        participantAnswer: { createManyAndReturn: mocks.createManyAndReturn },
        participant: { updateMany: mocks.updateMany },
        $transaction: mocks.transaction,
    },
}));

import { enqueueAnswer, flushSession } from "./answerQueue.js";
import { renderMetrics } from "./metrics.js";

function metricValue(name: string): number {
    const line = renderMetrics(0, 0).split("\n").find((entry) => entry.startsWith(`${name} `));
    if (!line) throw new Error(`Missing metric ${name}`);
    return Number(line.slice(name.length + 1));
}

function answer(participantId = "participant-1") {
    return {
        participantId,
        questionId: "question-1",
        answerId: "answer-1",
        timeMs: 100,
        isCorrect: true,
        points: 5,
    };
}

beforeEach(() => {
    mocks.createManyAndReturn.mockReset();
    mocks.transaction.mockReset().mockResolvedValue([]);
    mocks.updateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("answer queue metrics", () => {
    it("counts accepted submissions and only rows returned as inserted", async () => {
        const submittedBefore = metricValue("rexial_ws_answers_submitted_total");
        const persistedBefore = metricValue("rexial_ws_answers_persisted_total");
        mocks.createManyAndReturn.mockResolvedValue([{ participantId: "participant-1", points: 5 }]);

        expect(enqueueAnswer("metrics-success", answer())).toBe(true);
        expect(enqueueAnswer("metrics-success", answer())).toBe(false);
        await flushSession("metrics-success");

        expect(metricValue("rexial_ws_answers_submitted_total")).toBe(submittedBefore + 1);
        expect(metricValue("rexial_ws_answers_persisted_total")).toBe(persistedBefore + 1);
    });

    it("counts a failed flush and persists a requeued answer only once", async () => {
        const submittedBefore = metricValue("rexial_ws_answers_submitted_total");
        const persistedBefore = metricValue("rexial_ws_answers_persisted_total");
        const failuresBefore = metricValue("rexial_ws_answer_queue_flush_failures_total");
        mocks.createManyAndReturn
            .mockRejectedValueOnce(new Error("database unavailable"))
            .mockResolvedValueOnce([{ participantId: "participant-2", points: 5 }]);

        enqueueAnswer("metrics-retry", answer("participant-2"));
        await expect(flushSession("metrics-retry")).rejects.toThrow("database unavailable");
        await flushSession("metrics-retry");

        expect(metricValue("rexial_ws_answers_submitted_total")).toBe(submittedBefore + 1);
        expect(metricValue("rexial_ws_answers_persisted_total")).toBe(persistedBefore + 1);
        expect(metricValue("rexial_ws_answer_queue_flush_failures_total")).toBe(failuresBefore + 1);
    });

    it("counts score transaction errors separately from flush failures", async () => {
        const persistedBefore = metricValue("rexial_ws_answers_persisted_total");
        const failuresBefore = metricValue("rexial_ws_answer_queue_flush_failures_total");
        const transactionErrorsBefore = metricValue("rexial_ws_answer_queue_transaction_errors_total");
        mocks.createManyAndReturn
            .mockResolvedValueOnce([{ participantId: "participant-3", points: 5 }])
            .mockResolvedValueOnce([]);
        mocks.transaction.mockRejectedValueOnce(new Error("transaction timed out"));

        enqueueAnswer("metrics-transaction", answer("participant-3"));
        await expect(flushSession("metrics-transaction")).rejects.toThrow("transaction timed out");
        await flushSession("metrics-transaction");

        expect(metricValue("rexial_ws_answers_persisted_total")).toBe(persistedBefore + 1);
        expect(metricValue("rexial_ws_answer_queue_flush_failures_total")).toBe(failuresBefore + 1);
        expect(metricValue("rexial_ws_answer_queue_transaction_errors_total")).toBe(transactionErrorsBefore + 1);
    });
});
