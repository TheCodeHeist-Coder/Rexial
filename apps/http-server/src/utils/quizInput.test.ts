import { describe, expect, it } from 'vitest';
import { parseCreateQuiz, parseJoinQuiz } from './quizInput';

const joinError = (body: unknown) => {
    const result = parseJoinQuiz(body);
    return result.ok ? null : result.error;
};

const quizError = (body: unknown) => {
    const result = parseCreateQuiz(body);
    return result.ok ? null : result.error;
};

const join = { code: 'ABC123', username: 'ada' };
const quiz = { title: 'Capitals', description: 'Countries of Europe' };

describe('parseJoinQuiz', () => {
    it('accepts a normal join', () => {
        expect(parseJoinQuiz(join)).toEqual({ ok: true, data: join });
    });

    it('trims the username and leaves the code as sent', () => {
        expect(parseJoinQuiz({ code: ' abc ', username: '  ada lovelace  ' })).toEqual({
            ok: true,
            data: { code: ' abc ', username: 'ada lovelace' },
        });
    });

    it('allows 30 characters and counts them after the trim', () => {
        expect(parseJoinQuiz({ ...join, username: 'a'.repeat(30) }).ok).toBe(true);
        expect(parseJoinQuiz({ ...join, username: `  ${'a'.repeat(30)}  ` }).ok).toBe(true);
    });

    it('rejects a username longer than 30 characters', () => {
        expect(joinError({ ...join, username: 'a'.repeat(31) })).toBe('username must be at most 30 characters');
    });

    it.each([[{}], [['ada']], [[]], [42], [true]])('rejects a username of type %j', (username) => {
        expect(joinError({ ...join, username })).toBe('username must be a string');
    });

    it.each([[{}], [['ABC123']], [123456], [false]])('rejects a code of type %j', (code) => {
        expect(joinError({ ...join, code })).toBe('code must be a string');
    });

    it.each([[''], ['   '], ['\t\n'], [null]])('treats %j as not filled in', (value) => {
        expect(joinError({ ...join, username: value })).toBe('Code and username are required');
        expect(joinError({ ...join, code: value })).toBe('Code and username are required');
    });

    it('does not report a blank username as too long', () => {
        expect(joinError({ ...join, username: ' '.repeat(40) })).toBe('Code and username are required');
    });

    it.each([[undefined], [null], ['text'], [42], [[]], [[1, 2]]])('treats the body %j as all fields missing', (body) => {
        expect(joinError(body)).toBe('Code and username are required');
    });
});

describe('parseCreateQuiz', () => {
    it('accepts a normal quiz', () => {
        expect(parseCreateQuiz(quiz)).toEqual({ ok: true, data: quiz });
    });

    it('does not trim what it accepts', () => {
        const body = { title: ' Capitals ', description: ' Europe ' };
        expect(parseCreateQuiz(body)).toEqual({ ok: true, data: body });
    });

    it('allows a 120 character title and a 2000 character description', () => {
        expect(parseCreateQuiz({ title: 't'.repeat(120), description: 'd'.repeat(2000) }).ok).toBe(true);
    });

    it('rejects a title longer than 120 characters', () => {
        expect(quizError({ ...quiz, title: 't'.repeat(121) })).toBe('title must be at most 120 characters');
    });

    it('rejects a description longer than 2000 characters', () => {
        expect(quizError({ ...quiz, description: 'd'.repeat(2001) })).toBe('description must be at most 2000 characters');
    });

    it.each([[{}], [['Capitals']], [[]], [42], [true]])('rejects a title or description of type %j', (value) => {
        expect(quizError({ ...quiz, title: value })).toBe('title must be a string');
        expect(quizError({ ...quiz, description: value })).toBe('description must be a string');
    });

    it.each([[''], ['   '], ['\t\n'], [null]])('treats %j as not filled in', (value) => {
        expect(quizError({ ...quiz, title: value })).toBe('Title and description are required');
        expect(quizError({ ...quiz, description: value })).toBe('Title and description are required');
    });

    it.each([[undefined], [null], ['text'], [42], [[]], [[1, 2]]])('treats the body %j as all fields missing', (body) => {
        expect(quizError(body)).toBe('Title and description are required');
    });
});
