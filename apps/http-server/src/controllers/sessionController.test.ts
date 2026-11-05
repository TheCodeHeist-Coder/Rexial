import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { findUnique, participantCreate, transaction } = vi.hoisted(() => ({
    findUnique: vi.fn(),
    participantCreate: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock("@repo/db", () => ({ prisma: { quiz: { findUnique }, $transaction: transaction } }));

import { joinQuizController } from "./sessionController";

const run = async (body: unknown) => {
    const req = { body } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    await joinQuizController(req, res);
    return res;
};

describe("joinQuizController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ["an empty body", {}],
        ["no username", { code: "ABC123" }],
        ["no code", { username: "ada" }],
        ["an empty username", { code: "ABC123", username: "" }],
        ["a blank username", { code: "ABC123", username: "   " }],
        ["no body at all", undefined],
    ])("answers 400 with { success, error } for %s and never reads the quiz", async (_label, body) => {
        const res = await run(body);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Code and username are required" });
        expect(findUnique).not.toHaveBeenCalled();
    });

    it.each([
        ["an object username", { code: "ABC123", username: {} }, "username must be a string"],
        ["an array username", { code: "ABC123", username: ["ada"] }, "username must be a string"],
        ["a numeric username", { code: "ABC123", username: 42 }, "username must be a string"],
        ["an object code", { code: { contains: "A" }, username: "ada" }, "code must be a string"],
        ["an array code", { code: ["ABC123"], username: "ada" }, "code must be a string"],
        ["a 31 character username", { code: "ABC123", username: "a".repeat(31) }, "username must be at most 30 characters"],
    ])("answers 400 for %s instead of reaching prisma", async (_label, body, message) => {
        const res = await run(body);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: message });
        expect(findUnique).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
    });

    it("stores the trimmed username", async () => {
        findUnique.mockResolvedValue({
            id: "quiz-1",
            title: "Quiz",
            status: "ACTIVE",
            quizSessions: [{ id: "session-1", liveVideo: false }],
        });
        participantCreate.mockResolvedValue({ id: "participant-1" });
        transaction.mockImplementation((fn) => fn({ participant: { create: participantCreate } }));

        const res = await run({ code: "ABC123", username: "  ada  " });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { joinCode: "ABC123" } }));
        expect(participantCreate).toHaveBeenCalledWith({
            data: { username: "ada", sessionId: "session-1", userId: null },
        });
    });

    it("answers 404 in the same shape when the quiz does not exist", async () => {
        findUnique.mockResolvedValue(null);
        const res = await run({ code: "NOPE00", username: "ada" });

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: "Quiz not found" });
    });
});
