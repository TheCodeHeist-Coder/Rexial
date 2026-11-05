import { z } from 'zod';

export const MAX_USERNAME_LENGTH = 30;
export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;

const joinRequired = 'Code and username are required';
const quizRequired = 'Title and description are required';

// Missing, null and blank all read as "not filled in"; any other type is a
// different mistake and gets its own message.
const requiredString = (field: string, required: string) =>
    z
        .string({
            error: (issue) =>
                issue.input === undefined || issue.input === null ? required : `${field} must be a string`,
        })
        .refine((value) => value.trim().length > 0, required);

const tooLong = (field: string, max: number) => `${field} must be at most ${max} characters`;

const joinQuizSchema = z.object({
    code: requiredString('code', joinRequired),
    // The limit counts what gets stored, so trim first.
    username: requiredString('username', joinRequired)
        .trim()
        .max(MAX_USERNAME_LENGTH, tooLong('username', MAX_USERNAME_LENGTH)),
});

const createQuizSchema = z.object({
    title: requiredString('title', quizRequired).max(MAX_TITLE_LENGTH, tooLong('title', MAX_TITLE_LENGTH)),
    description: requiredString('description', quizRequired).max(
        MAX_DESCRIPTION_LENGTH,
        tooLong('description', MAX_DESCRIPTION_LENGTH)
    ),
});

// One message for the 400 response, for the first field that failed.
const parseBody = <T>(schema: z.ZodType<T>, body: unknown):
    | { ok: true; data: T }
    | { ok: false; error: string } => {
    // A request with no JSON body has no req.body at all.
    const input = typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {};

    const result = schema.safeParse(input);
    if (result.success) return { ok: true, data: result.data };

    return { ok: false, error: result.error.issues[0].message };
};

// Checks the body of POST /session/join. username comes back trimmed.
export const parseJoinQuiz = (body: unknown) => parseBody(joinQuizSchema, body);

// Checks the body of POST /quizzes. The values are returned as sent.
export const parseCreateQuiz = (body: unknown) => parseBody(createQuizSchema, body);
