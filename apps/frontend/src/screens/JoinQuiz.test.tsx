import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JoinQuiz from './JoinQuiz';

vi.mock('../services/api', () => ({
    api: { post: vi.fn() },
}));

vi.mock('../components/BgBoss', () => ({
    default: () => null,
}));

const { api } = await import('../services/api');

function PlayState() {
    const location = useLocation();

    return (
        <div>
            <span>Joined</span>
            <pre data-testid="play-state">{JSON.stringify(location.state)}</pre>
        </div>
    );
}

function renderJoin() {
    render(
        <MemoryRouter initialEntries={['/join']}>
            <Routes>
                <Route path="/join" element={<JoinQuiz />} />
                <Route path="/quiz/play/:sessionId" element={<PlayState />} />
            </Routes>
        </MemoryRouter>
    );

    return userEvent.setup();
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.mocked(api.post).mockResolvedValue({
        data: {
            participantId: 'participant-1',
            sessionId: 'session-1',
            quizTitle: 'Test Quiz',
        },
    });
});

describe('JoinQuiz input normalization', () => {
    it('normalizes a pasted PIN before applying the six-character limit and trims the nickname on submit', async () => {
        const user = renderJoin();

        const codeInput = screen.getByPlaceholderText('e.g. XY3F12');
        const nicknameInput = screen.getByPlaceholderText('Enter your name');

        await user.click(codeInput);
        await user.paste(' XY3F12 ');

        expect(codeInput).toHaveValue('XY3F12');

        await user.type(nicknameInput, '  bob  ');
        await user.click(screen.getByRole('button', { name: 'Enter Game' }));

        await waitFor(() =>
            expect(api.post).toHaveBeenCalledWith('/session/join', {
                code: 'XY3F12',
                username: 'bob',
            })
        );

        expect(localStorage.getItem('username')).toBe('bob');

        expect(await screen.findByText('Joined')).toBeInTheDocument();
        expect(screen.getByTestId('play-state')).toHaveTextContent('"username":"bob"');
    });

    it('rejects a whitespace-only nickname without calling the join API', async () => {
        const user = renderJoin();

        await user.type(screen.getByPlaceholderText('e.g. XY3F12'), 'AB12CD');
        await user.type(screen.getByPlaceholderText('Enter your name'), '   ');
        await user.click(screen.getByRole('button', { name: 'Enter Game' }));

        expect(await screen.findByText('Nickname cannot be empty')).toBeInTheDocument();
        expect(api.post).not.toHaveBeenCalled();
    });
});