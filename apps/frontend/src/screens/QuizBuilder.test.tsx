import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuizBuilder from './QuizBuilder';

vi.mock('../services/api', () => ({
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
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
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
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

    async function fillManualQuestion(user: ReturnType<typeof renderBuilder>, secs: string) {
        await screen.findByText('What is ATP?');
        await user.click(screen.getByRole('button', { name: /add question/i }));
        await user.type(screen.getByPlaceholderText('Add Question Here...'), 'Manual?');
        for (const i of [1, 2, 3, 4]) {
            await user.type(screen.getByPlaceholderText(`Answer ${i}`), `A${i}`);
        }
        await user.clear(screen.getByPlaceholderText('Secs'));
        if (secs) await user.type(screen.getByPlaceholderText('Secs'), secs);
        await user.click(screen.getByRole('button', { name: /save question/i }));
    }

    it.each(['-5', '0', '4', '301', '99999999999', '1.5', 'abc'])(
        'does not send a question with %s seconds',
        async (secs) => {
            const user = renderBuilder();
            await fillManualQuestion(user, secs);

            expect(await screen.findByRole('alert')).toHaveTextContent(
                'Seconds must be a whole number from 5 to 300'
            );
            expect(api.post).not.toHaveBeenCalled();
        }
    );

    it('falls back to 15 seconds when the field is left empty', async () => {
        const user = renderBuilder();
        await fillManualQuestion(user, '');

        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith(
                '/quizzes/quiz-1/questions',
                expect.objectContaining({ timeLimit: 15 })
            )
        );
    });

    it('shows the server error in the form and keeps it open when saving fails', async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
            response: { data: { error: 'timeLimit must be a whole number from 5 to 300' } },
        });

        const user = renderBuilder();
        await fillManualQuestion(user, '20');

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'timeLimit must be a whole number from 5 to 300'
        );
        expect(screen.getByPlaceholderText('Add Question Here...')).toHaveValue('Manual?');
    });
});

describe('QuizBuilder question deletion', () => {
    it('shows confirmation dialog when Delete button is clicked and cancels when requested', async () => {
        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        const deleteBtn = screen.getByRole('button', { name: /delete/i });
        await user.click(deleteBtn);

        // Confirmation modal is visible
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByText('Delete Question')).toBeInTheDocument();
        expect(within(dialog).getByText(/"What is ATP\?"/i)).toBeInTheDocument();

        // Clicking cancel dismisses the dialog without deleting
        const cancelBtn = within(dialog).getByRole('button', { name: /cancel/i });
        await user.click(cancelBtn);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(api.delete).not.toHaveBeenCalled();
        expect(screen.getByText('What is ATP?')).toBeInTheDocument();
    });

    it('deletes question when confirmed and removes it from the UI', async () => {
        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        await user.click(screen.getByRole('button', { name: /delete/i }));

        const dialog = screen.getByRole('dialog');
        const confirmDeleteBtn = within(dialog).getByRole('button', { name: /^delete$/i });
        await user.click(confirmDeleteBtn);

        await waitFor(() =>
            expect(api.delete).toHaveBeenCalledWith('/quizzes/quiz-1/questions/q1')
        );

        // Modal closed and question is gone
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.queryByText('What is ATP?')).not.toBeInTheDocument();
        });

        // Zero questions state is shown
        expect(screen.getByText('No questions added yet.')).toBeInTheDocument();
    });

    it('shows error and keeps question when deletion fails', async () => {
        vi.mocked(api.delete).mockRejectedValueOnce({
            response: { data: { error: 'Failed to delete question' } },
        });

        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        await user.click(screen.getByRole('button', { name: /delete/i }));

        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

        // Error message displayed
        await screen.findByText('Failed to delete question');

        // Question is still in the document
        expect(screen.getByText('What is ATP?')).toBeInTheDocument();
    });

    it('deletes the correct question when multiple questions exist', async () => {
        const multiQuiz = {
            ...quiz,
            questions: [
                { id: 'q1', text: 'First question', timeLimit: 15, difficulty: 'Low', answers },
                { id: 'q2', text: 'Second question', timeLimit: 20, difficulty: 'High', answers },
            ],
        };
        vi.mocked(api.get).mockResolvedValueOnce({ data: multiQuiz });

        const user = renderBuilder();
        await screen.findByText('First question');
        await screen.findByText('Second question');

        // Find the delete button on the second question card
        const secondCard = screen.getByText('Second question').closest('div.group') as HTMLElement;
        const deleteSecondBtn = within(secondCard).getByRole('button', { name: /delete/i });
        await user.click(deleteSecondBtn);

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/"Second question"/i)).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));

        await waitFor(() =>
            expect(api.delete).toHaveBeenCalledWith('/quizzes/quiz-1/questions/q2')
        );

        // Second question removed, first question remains
        await waitFor(() => {
            expect(screen.queryByText('Second question')).not.toBeInTheDocument();
        });
        expect(screen.getByText('First question')).toBeInTheDocument();
    });
});

describe('QuizBuilder error states', () => {
    it('shows an error with a retry instead of an empty list when loading fails', async () => {
        vi.mocked(api.get).mockRejectedValueOnce(new Error('network down'));

        const user = renderBuilder();

        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load this quiz');
        expect(screen.queryByText('No questions added yet.')).not.toBeInTheDocument();

        vi.mocked(api.get).mockResolvedValueOnce({ data: quiz });
        await user.click(screen.getByRole('button', { name: 'Retry' }));

        expect(await screen.findByText('What is ATP?')).toBeInTheDocument();
    });

    it('surfaces a failed generate-code request', async () => {
        vi.mocked(api.post).mockRejectedValueOnce(new Error('500'));

        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        await user.click(screen.getByRole('button', { name: /generate join code/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Failed to generate a join code');
        expect(api.post).toHaveBeenCalledWith('/quizzes/quiz-1/generate-access-code');
    });
});


describe('QuizBuilder co-organizers', () => {
    it('lists the owner, accepted and pending organizers from quizOrganizers', async () => {
        vi.mocked(api.get).mockResolvedValue({
            data: {
                ...quiz,
                quizOrganizers: [
                    { id: 'o1', role: 'OWNER', inviteStatus: 'ACCEPTED', inviteEmail: null, user: { name: 'Olivia Owner' } },
                    { id: 'o2', role: 'CO_ORGANIZER', inviteStatus: 'ACCEPTED', inviteEmail: 'sam@example.com', user: { name: 'Sam' } },
                    { id: 'o3', role: 'CO_ORGANIZER', inviteStatus: 'PENDING', inviteEmail: 'new@example.com', user: null },
                ],
            },
        });

        renderBuilder();

        expect(await screen.findByText('Olivia Owner')).toBeInTheDocument();
        expect(screen.getByText('OWNER')).toBeInTheDocument();
        expect(screen.getByText('Sam')).toBeInTheDocument();
        expect(screen.getByText('ACCEPTED')).toBeInTheDocument();
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
        expect(screen.getByText('PENDING')).toBeInTheDocument();
    });

    it('shows the reason the server gave when an invite is refused', async () => {
        vi.mocked(api.post).mockRejectedValueOnce({
            response: { data: { success: false, error: 'Already invited' } },
        });

        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        await user.type(screen.getByPlaceholderText('Email'), 'sam@example.com');
        await user.click(screen.getByRole('button', { name: /send/i }));

        expect(await screen.findByText('Already invited')).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledWith('/quizzes/quiz-1/invite', { email: 'sam@example.com' });
    });

    it('falls back to a generic message when the server gives no reason', async () => {
        vi.mocked(api.post).mockRejectedValueOnce(new Error('network down'));

        const user = renderBuilder();
        await screen.findByText('What is ATP?');

        await user.type(screen.getByPlaceholderText('Email'), 'sam@example.com');
        await user.click(screen.getByRole('button', { name: /send/i }));

        expect(await screen.findByText('Failed to invite.')).toBeInTheDocument();
    });
});

describe('QuizBuilder Host Live during a running session', () => {
    const running = { sessonId: 'session-running', liveVideo: false, inProgress: true };

    function renderHost() {
        render(
            <MemoryRouter initialEntries={['/quiz/quiz-1/edit']}>
                <Routes>
                    <Route path="/quiz/:id/edit" element={<QuizBuilder />} />
                    <Route path="/quiz/manage/session-running" element={<p>running screen</p>} />
                    <Route path="/quiz/manage/session-new" element={<p>new lobby screen</p>} />
                </Routes>
            </MemoryRouter>
        );
        return userEvent.setup();
    }

    async function pressHostLive() {
        vi.mocked(api.get).mockResolvedValue({ data: { ...quiz, status: 'ACTIVE' } });
        const user = renderHost();
        await user.click(await screen.findByRole('button', { name: 'Host Live' }));
        return user;
    }

    it('goes straight to the lobby when nothing is running', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: { sessonId: 'session-new' } });

        await pressHostLive();

        expect(await screen.findByText('new lobby screen')).toBeInTheDocument();
    });

    it('asks first, and can return to the running session', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: running });
        const user = await pressHostLive();

        const dialog = await screen.findByRole('dialog', { name: 'A session is already running' });
        await user.click(within(dialog).getByRole('button', { name: 'Return to session' }));

        expect(screen.getByText('running screen')).toBeInTheDocument();
        expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('starts a new session only when the host chooses to', async () => {
        vi.mocked(api.post)
            .mockResolvedValueOnce({ data: running })
            .mockResolvedValueOnce({ data: { sessonId: 'session-new' } });
        const user = await pressHostLive();

        await user.click(await screen.findByRole('button', { name: 'Start new session' }));

        expect(await screen.findByText('new lobby screen')).toBeInTheDocument();
        expect(vi.mocked(api.post).mock.calls.map((call) => call[1])).toEqual([
            { liveVideo: false },
            { liveVideo: false, restart: true },
        ]);
    });

    it('changes nothing when the choice is cancelled', async () => {
        vi.mocked(api.post).mockResolvedValue({ data: running });
        const user = await pressHostLive();

        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.getByRole('button', { name: 'Host Live' })).toBeEnabled();
        expect(api.post).toHaveBeenCalledTimes(1);
    });
});
