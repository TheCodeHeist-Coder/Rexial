import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CanceledError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedQuestion, RequestOptions } from '../services/genaiApi';
import AiQuizGenerator from './AiQuizGenerator';

vi.mock('../services/genaiApi', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/genaiApi')>()),
    generateQuiz: vi.fn(),
    askPdf: vi.fn(),
    chat: vi.fn(),
}));

const api = await import('../services/genaiApi');
const generateQuiz = vi.mocked(api.generateQuiz);
const askPdf = vi.mocked(api.askPdf);
const chat = vi.mocked(api.chat);

const question = (text: string, difficulty: GeneratedQuestion['difficulty'] = 'Medium'): GeneratedQuestion => ({
    text,
    difficulty,
    options: [0, 1, 2, 3].map((i) => ({ text: `${text} option ${i}`, isCorrect: i === 0 })),
});

const pdf = () => new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' });

function setup(props: Partial<React.ComponentProps<typeof AiQuizGenerator>> = {}) {
    const handlers = {
        onSave: vi
            .fn<(question: GeneratedQuestion, timeLimit: number) => Promise<void>>()
            .mockResolvedValue(undefined),
        onSaved: vi.fn(),
        onClose: vi.fn(),
    };

    render(<AiQuizGenerator existingQuestions={['Already in quiz?']} {...handlers} {...props} />);

    return { user: userEvent.setup(), ...handlers };
}

async function choosePdf(user: ReturnType<typeof userEvent.setup>) {
    await user.upload(screen.getByTestId('pdf-input'), pdf());
}

async function generate(user: ReturnType<typeof userEvent.setup>, questions: GeneratedQuestion[]) {
    generateQuiz.mockResolvedValueOnce(questions);
    await user.click(screen.getByRole('button', { name: /^generate \d+ question/i }));
    await waitFor(() => expect(screen.getAllByTestId('draft')).toHaveLength(questions.length));
}

const draftTexts = () =>
    screen.getAllByLabelText('Question text').map((el) => (el as HTMLInputElement).value);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('PDF picker', () => {
    it('keeps Generate disabled until a PDF is chosen', async () => {
        const { user } = setup();
        const button = screen.getByRole('button', { name: /generate 5 questions/i });

        expect(button).toBeDisabled();
        await choosePdf(user);
        expect(button).toBeEnabled();
        expect(screen.getByText('notes.pdf')).toBeInTheDocument();
    });

    it('rejects files that are not PDFs', () => {
        setup();

        fireEvent.change(screen.getByTestId('pdf-input'), {
            target: { files: [new File(['x'], 'notes.docx', { type: 'application/msword' })] },
        });

        expect(screen.getByRole('alert')).toHaveTextContent('Only PDF files are supported.');
        expect(screen.queryByText('notes.docx')).not.toBeInTheDocument();
    });

    it('rejects PDFs over the size limit before uploading', () => {
        setup();
        const big = pdf();
        Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });

        fireEvent.change(screen.getByTestId('pdf-input'), { target: { files: [big] } });

        expect(screen.getByRole('alert')).toHaveTextContent('The limit is 10 MB.');
        expect(screen.getByRole('button', { name: /generate 5 questions/i })).toBeDisabled();
    });

    it('accepts a dropped PDF and can remove it', async () => {
        const { user } = setup();

        fireEvent.drop(screen.getByText(/drop a pdf here/i), {
            dataTransfer: { files: [pdf()] },
        });

        expect(screen.getByText('notes.pdf')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Remove PDF' }));
        expect(screen.queryByText('notes.pdf')).not.toBeInTheDocument();
    });
});

describe('Generating', () => {
    it('sends the chosen settings and excludes questions already in the quiz', async () => {
        const { user } = setup();
        await choosePdf(user);

        await user.click(screen.getByRole('button', { name: '10' }));
        await user.click(screen.getByRole('button', { name: 'High' }));
        await user.type(screen.getByLabelText('Focus'), 'chapter 2');
        await generate(user, [question('Q1', 'High')]);

        expect(generateQuiz).toHaveBeenCalledWith(
            expect.any(File),
            { count: 10, difficulty: 'High', topic: 'chapter 2', exclude: ['Already in quiz?'] },
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
    });

    it('appends a second batch instead of replacing unsaved drafts', async () => {
        const { user } = setup();
        await choosePdf(user);

        await generate(user, [question('Q1'), question('Q2')]);
        generateQuiz.mockResolvedValueOnce([question('Q3')]);
        await user.click(screen.getByRole('button', { name: /generate 5 questions/i }));

        await waitFor(() => expect(draftTexts()).toEqual(['Q1', 'Q2', 'Q3']));
        expect(generateQuiz.mock.calls[1][1].exclude).toEqual(['Already in quiz?', 'Q1', 'Q2']);
    });

    it('shows the API error message', async () => {
        const { user } = setup();
        await choosePdf(user);

        generateQuiz.mockRejectedValueOnce(new Error('boom'));
        await user.click(screen.getByRole('button', { name: /generate 5 questions/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to generate questions.');
    });

    it('shows progress and can be cancelled without an error', async () => {
        const { user } = setup();
        await choosePdf(user);

        generateQuiz.mockImplementationOnce(
            (_file, _settings, options?: RequestOptions) =>
                new Promise((_resolve, reject) => {
                    options?.signal?.addEventListener('abort', () => reject(new CanceledError()));
                })
        );

        await user.click(screen.getByRole('button', { name: /generate 5 questions/i }));

        const progress = await screen.findByRole('status');
        expect(progress).toHaveTextContent(/reading the pdf and writing questions/i);

        await user.click(within(progress).getByRole('button', { name: 'Cancel' }));

        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /generate 5 questions/i })).toBeEnabled();
    });
});

describe('Reviewing', () => {
    it('regenerates one question in place with its difficulty', async () => {
        const { user } = setup();
        await choosePdf(user);
        await generate(user, [question('Q1', 'Low'), question('Q2', 'High'), question('Q3')]);

        generateQuiz.mockResolvedValueOnce([question('Fresh Q2', 'High')]);
        await user.click(screen.getAllByRole('button', { name: 'Regenerate this question' })[1]);

        await waitFor(() => expect(draftTexts()).toEqual(['Q1', 'Fresh Q2', 'Q3']));
        expect(generateQuiz.mock.calls[1][1]).toEqual({
            count: 1,
            difficulty: 'High',
            topic: '',
            exclude: ['Already in quiz?', 'Q1', 'Q2', 'Q3'],
        });
    });

    it('selects all and none', async () => {
        const { user } = setup();
        await choosePdf(user);
        await generate(user, [question('Q1'), question('Q2')]);

        await user.click(screen.getByRole('button', { name: 'Select none' }));
        expect(screen.getByRole('button', { name: 'Add 0 to Quiz' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Select all' }));
        expect(screen.getByRole('button', { name: 'Add 2 to Quiz' })).toBeEnabled();
    });

    it('rejects an invalid time limit', async () => {
        const { user, onSave } = setup();
        await choosePdf(user);
        await generate(user, [question('Q1')]);

        const seconds = screen.getByRole('spinbutton', { name: 'Seconds per question' });
        await user.clear(seconds);
        await user.type(seconds, '2');
        await user.click(screen.getByRole('button', { name: 'Add 1 to Quiz' }));

        expect(screen.getByRole('alert')).toHaveTextContent('from 5 to 300 seconds');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('saves edits, the chosen difficulty and the time preset, then closes', async () => {
        const { user, onSave, onSaved, onClose } = setup();
        await choosePdf(user);
        await generate(user, [question('Q1'), question('Q2')]);

        await user.selectOptions(screen.getAllByLabelText('Question difficulty')[0], 'High');
        await user.click(screen.getAllByRole('button', { name: 'Mark option 3 correct' })[0]);
        await user.click(screen.getByRole('button', { name: '30s' }));
        await user.click(screen.getByRole('button', { name: 'Add 2 to Quiz' }));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(onSave).toHaveBeenCalledTimes(2);

        const [saved, seconds] = onSave.mock.calls[0];
        expect(seconds).toBe(30);
        expect(saved.difficulty).toBe('High');
        expect(saved.options.map((o) => o.isCorrect)).toEqual([false, false, true, false]);
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(screen.queryAllByTestId('draft')).toHaveLength(0);
    });

    it('never saves a question twice after a partial failure', async () => {
        const { user, onSave, onSaved, onClose } = setup();
        await choosePdf(user);
        await generate(user, [question('Q1'), question('Q2'), question('Q3')]);

        onSave.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network'));
        await user.click(screen.getByRole('button', { name: 'Add 3 to Quiz' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Saved 1 of 3 questions');
        expect(draftTexts()).toEqual(['Q2', 'Q3']);
        // the question that did save shows up in the quiz straight away
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Add 2 to Quiz' }));
        await waitFor(() => expect(onClose).toHaveBeenCalled());

        const savedTexts = onSave.mock.calls.map(([q]) => q.text);
        expect(savedTexts).toEqual(['Q1', 'Q2', 'Q2', 'Q3']);
        expect(savedTexts.filter((t) => t === 'Q1')).toHaveLength(1);
    });
});

describe('Other tabs', () => {
    it('answers questions about the same PDF', async () => {
        const { user } = setup();
        await choosePdf(user);

        await user.click(screen.getByRole('tab', { name: 'Ask the PDF' }));
        expect(screen.getByText('notes.pdf')).toBeInTheDocument();

        askPdf.mockResolvedValueOnce({
            message: 'ok',
            filename: 'notes.pdf',
            question: 'What is covered?',
            answer: 'Photosynthesis.',
        });
        await user.type(screen.getByLabelText('Question about the PDF'), 'What is covered?{Enter}');

        const exchange = await screen.findByTestId('exchange');
        expect(exchange).toHaveTextContent('What is covered?');
        expect(exchange).toHaveTextContent('Photosynthesis.');
        expect(askPdf).toHaveBeenCalledWith(expect.any(File), 'What is covered?', expect.anything());
    });

    it('chats with the assistant and keeps drafts when switching tabs', async () => {
        const { user } = setup();
        await choosePdf(user);
        await generate(user, [question('Q1')]);

        await user.click(screen.getByRole('tab', { name: 'Assistant' }));
        chat.mockResolvedValueOnce('Here are some facts.');
        await user.type(screen.getByLabelText('Message the assistant'), 'Solar system facts{Enter}');

        expect(await screen.findByTestId('message-assistant')).toHaveTextContent('Here are some facts.');
        expect(screen.getByTestId('message-user')).toHaveTextContent('Solar system facts');
        expect(screen.getByLabelText('Message the assistant')).toHaveValue('');

        await user.click(screen.getByRole('tab', { name: 'Generate quiz' }));
        expect(draftTexts()).toEqual(['Q1']);
    });

    it('shows assistant errors', async () => {
        const { user } = setup();
        await user.click(screen.getByRole('tab', { name: 'Assistant' }));

        chat.mockRejectedValueOnce(new Error('down'));
        await user.type(screen.getByLabelText('Message the assistant'), 'hi{Enter}');

        expect(await screen.findByRole('alert')).toHaveTextContent('The assistant failed to reply.');
    });
});
