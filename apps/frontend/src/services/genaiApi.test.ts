import { AxiosError, CanceledError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { genaiApi, genaiErrorMessage, generateQuiz, isCancelled } from './genaiApi';

describe('generateQuiz', () => {
    it('sends the settings as multipart form fields', async () => {
        const post = vi
            .spyOn(genaiApi, 'post')
            .mockResolvedValue({ data: { questions: [{ text: 'Q' }] } });
        const file = new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' });
        const controller = new AbortController();
        const onUploadProgress = vi.fn();

        const questions = await generateQuiz(
            file,
            { count: 3, difficulty: 'Low', topic: 'cells', exclude: ['Old?'] },
            { signal: controller.signal, onUploadProgress }
        );

        expect(questions).toEqual([{ text: 'Q' }]);

        const [url, form, config] = post.mock.calls[0] as [
            string,
            FormData,
            {
                signal: AbortSignal;
                onUploadProgress: (e: { loaded: number; total: number }) => void;
            },
        ];
        expect(url).toBe('/generate-quiz');
        expect(form.get('file')).toBeInstanceOf(File);
        expect(form.get('count')).toBe('3');
        expect(form.get('difficulty')).toBe('Low');
        expect(form.get('user_query')).toBe('cells');
        expect(JSON.parse(form.get('exclude') as string)).toEqual(['Old?']);
        expect(config.signal).toBe(controller.signal);

        config.onUploadProgress({ loaded: 50, total: 200 });
        expect(onUploadProgress).toHaveBeenCalledWith(25);
    });
});

describe('genaiErrorMessage', () => {
    const withResponse = (status: number, data: unknown) =>
        new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
            status,
            data,
            statusText: '',
            headers: {},
            config: {} as never,
        });

    it('uses the FastAPI detail string', () => {
        expect(genaiErrorMessage(withResponse(413, { detail: 'PDF is too large.' }), 'x')).toBe(
            'PDF is too large.'
        );
    });

    it('uses the first validation error message', () => {
        const err = withResponse(422, { detail: [{ msg: 'Input should be less than or equal to 20' }] });
        expect(genaiErrorMessage(err, 'x')).toBe('Input should be less than or equal to 20');
    });

    it('explains an unreachable service', () => {
        expect(genaiErrorMessage(new AxiosError('Network Error'), 'x')).toMatch(/could not reach/i);
    });

    it('falls back for unknown errors', () => {
        expect(genaiErrorMessage(new Error('?'), 'fallback')).toBe('fallback');
    });

    it('recognises cancellations', () => {
        expect(isCancelled(new CanceledError())).toBe(true);
        expect(isCancelled(new Error('no'))).toBe(false);
    });
});
