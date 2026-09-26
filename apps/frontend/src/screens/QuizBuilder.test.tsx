import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizBuilder from './QuizBuilder';

vi.mock('../services/api', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../services/genaiApi', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/genaiApi')>()),
    generateQuiz: vi.fn(),
}));

const { api } = await import('../services/api');
const { generateQuiz } = await import('../services/genaiApi');

const answers = [0, 1, 2, 3].map((i) => ({ id: `a${i}`, text: `Answer ${i}`, isCorrect: i === 0 }));

const quiz = {
    id: 'quiz-1',
    title: 'Biology',
    status: 'DRAFT',
    questions: [
        { id: 'q1', text: 'What is ATP?', timeLimit: 15, difficulty: 'High', answers },
    ],
    organizers: [],
};

function renderBuilder() {
    render(
        <MemoryRouter initialEntries={['/quiz/quiz-1/edit']}>
            <Routes>
                <Route path="/quiz/:id/edit" element={<QuizBuilder />} />
            </Routes>
        </MemoryRouter>
    );

    return userEvent.setup();
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: quiz });
    vi.mocked(api.post).mockResolvedValue({ data: {} });
});

describe('QuizBuilder AI integration', () => {
    it('shows each question difficulty', async () => {
        renderBuilder();

        const title = await screen.findByText('What is ATP?');
        const card = title.closest('div.group') as HTMLElement;

        expect(within(card).getByText('High')).toBeInTheDocument();
    });

    it('keeps AI drafts when the panel is closed and reopened', async () => {
        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        await user.click(screen.getByRole('button', { name: /generate with ai/i }));
        await user.upload(
            screen.getByTestId('pdf-input'),
            new File(['%PDF'], 'bio.pdf', { type: 'application/pdf' })
        );

        vi.mocked(generateQuiz).mockResolvedValueOnce([
            {
                text: 'What is a ribosome?',
                difficulty: 'Low',
                options: answers.map(({ text, isCorrect }) => ({ text, isCorrect })),
            },
        ]);
        await user.click(screen.getByRole('button', { name: /generate 5 questions/i }));
        await screen.findByDisplayValue('What is a ribosome?');

        // questions already in the quiz are excluded from generation
        expect(vi.mocked(generateQuiz).mock.calls[0][1].exclude).toEqual(['What is ATP?']);

        await user.click(screen.getByRole('button', { name: 'Close AI panel' }));
        expect(screen.getByDisplayValue('What is a ribosome?')).not.toBeVisible();

        await user.click(screen.getByRole('button', { name: /generate with ai/i }));
        expect(screen.getByDisplayValue('What is a ribosome?')).toBeVisible();

        await user.click(screen.getByRole('button', { name: 'Add 1 to Quiz' }));

        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith('/quizzes/quiz-1/questions', {
                text: 'What is a ribosome?',
                timeLimit: 15,
                difficulty: 'Low',
                answers: answers.map(({ text, isCorrect }) => ({ text, isCorrect })),
            })
        );
        // the quiz is reloaded so the new question appears
        await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    });

    it('saves the difficulty picked for a manual question', async () => {
        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        await user.click(screen.getByRole('button', { name: /add question/i }));
        await user.type(screen.getByPlaceholderText('Add Question Here...'), 'Manual?');
        for (const i of [1, 2, 3, 4]) {
            await user.type(screen.getByPlaceholderText(`Answer ${i}`), `A${i}`);
        }
        await user.click(
            within(screen.getByRole('group', { name: 'Difficulty' })).getByRole('button', { name: 'Low' })
        );
        await user.click(screen.getByRole('button', { name: /save question/i }));

        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith(
                '/quizzes/quiz-1/questions',
                expect.objectContaining({ text: 'Manual?', difficulty: 'Low' })
            )
        );
    });
});
