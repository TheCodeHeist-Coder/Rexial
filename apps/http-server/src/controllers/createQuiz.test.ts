import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: { quiz: { create } } }));

import { createQuizController } from "./quizController";

const run = async (body: unknown) => {
    const req = { body, userId: "user-1" } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    await createQuizController(req, res);
    return res;
};

const valid = { title: "Capitals", description: "Countries of Europe" };

describe("createQuizController", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        create.mockResolvedValue({ id: "quiz-1" });
    });

    it.each([
        ["no body at all", undefined, "Title and description are required"],
        ["no title", { description: "d" }, "Title and description are required"],
        ["no description", { title: "t" }, "Title and description are required"],
        ["an empty title", { ...valid, title: "" }, "Title and description are required"],
        ["a blank description", { ...valid, description: "   " }, "Title and description are required"],
        ["an object title", { ...valid, title: {} }, "title must be a string"],
        ["an array title", { ...valid, title: ["Capitals"] }, "title must be a string"],
        ["a numeric title", { ...valid, title: 42 }, "title must be a string"],
        ["an object description", { ...valid, description: {} }, "description must be a string"],
        ["an array description", { ...valid, description: ["d"] }, "description must be a string"],
        ["a 121 character title", { ...valid, title: "t".repeat(121) }, "title must be at most 120 characters"],
        [
            "a 2001 character description",
            { ...valid, description: "d".repeat(2001) },
            "description must be at most 2000 characters",
        ],
    ])("answers 400 for %s and never creates the quiz", async (_label, body, message) => {
        const res = await run(body);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, error: message });
        expect(create).not.toHaveBeenCalled();
    });

    it("still creates a valid quiz with a 201", async () => {
        const res = await run(valid);

        expect(create).toHaveBeenCalledWith({
            data: expect.objectContaining({ ...valid, creatorId: "user-1" }),
        });
        expect(res.status).toHaveBeenCalledWith(201);
    });
});
