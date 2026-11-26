import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    createManyAndReturn: vi.fn(),
    pollUpdate: vi.fn(),
    optionUpdate: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("@repo/db", () => ({
    prisma: {
        pollVote: { createManyAndReturn: mocks.createManyAndReturn },
        poll: { update: mocks.pollUpdate },
        pollOption: { update: mocks.optionUpdate },
        $transaction: mocks.transaction,
    },
}));

import { drainPollVotes, enqueuePollVote, flushSession } from "./pollVoteQueue.js";

const tx = {
    pollVote: { createManyAndReturn: mocks.createManyAndReturn },
    poll: { update: mocks.pollUpdate },
    pollOption: { update: mocks.optionUpdate },
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((operation) => operation(tx));
    mocks.createManyAndReturn.mockResolvedValue([]);
    mocks.pollUpdate.mockResolvedValue({});
    mocks.optionUpdate.mockResolvedValue({});
});

describe("poll vote queue", () => {
    it("inserts a batch and increments counts only for rows accepted by the unique constraint", async () => {
        mocks.createManyAndReturn.mockResolvedValue([
            { pollId: "poll-1", optionId: "option-a" },
            { pollId: "poll-1", optionId: "option-b" },
        ]);

        expect(enqueuePollVote("session-batch", {
            pollId: "poll-1", optionId: "option-a", participantId: "p-1",
        })).toBe(true);
        expect(enqueuePollVote("session-batch", {
            pollId: "poll-1", optionId: "option-a", participantId: "p-2",
        })).toBe(true);
        expect(enqueuePollVote("session-batch", {
            pollId: "poll-1", optionId: "option-b", participantId: "p-3",
        })).toBe(true);
        expect(enqueuePollVote("session-batch", {
            pollId: "poll-1", optionId: "option-b", participantId: "p-3",
        })).toBe(false);

        await flushSession("session-batch");

        expect(mocks.createManyAndReturn).toHaveBeenCalledWith({
            data: [
                { pollId: "poll-1", optionId: "option-a", participantId: "p-1" },
                { pollId: "poll-1", optionId: "option-a", participantId: "p-2" },
                { pollId: "poll-1", optionId: "option-b", participantId: "p-3" },
            ],
            skipDuplicates: true,
            select: { pollId: true, optionId: true },
        });
        expect(mocks.pollUpdate).toHaveBeenCalledWith({
            where: { id: "poll-1" },
            data: { totalVotes: { increment: 2 } },
        });
        expect(mocks.optionUpdate).toHaveBeenCalledTimes(2);
        expect(mocks.optionUpdate).toHaveBeenCalledWith({
            where: { id: "option-a" },
            data: { voteCount: { increment: 1 } },
        });
        expect(mocks.optionUpdate).toHaveBeenCalledWith({
            where: { id: "option-b" },
            data: { voteCount: { increment: 1 } },
        });
    });

    it("requeues a failed transaction so the full batch can be retried", async () => {
        mocks.transaction
            .mockRejectedValueOnce(new Error("database unavailable"))
            .mockImplementationOnce((operation) => operation(tx));
        mocks.createManyAndReturn.mockResolvedValue([
            { pollId: "poll-2", optionId: "option-c" },
        ]);
        enqueuePollVote("session-retry", {
            pollId: "poll-2", optionId: "option-c", participantId: "p-4",
        });

        await expect(flushSession("session-retry")).rejects.toThrow("database unavailable");
        await drainPollVotes("session-retry");

        expect(mocks.createManyAndReturn).toHaveBeenCalledTimes(1);
        expect(mocks.pollUpdate).toHaveBeenCalledWith({
            where: { id: "poll-2" },
            data: { totalVotes: { increment: 1 } },
        });
        expect(mocks.optionUpdate).toHaveBeenCalledWith({
            where: { id: "option-c" },
            data: { voteCount: { increment: 1 } },
        });
    });
});
