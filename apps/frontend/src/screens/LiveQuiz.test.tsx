import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveQuiz from './LiveQuiz';
import { useAuthStore } from '../store/authStore';

vi.mock('../components/BgBoss', () => ({
    default: () => null,
}));

const sockets: FakeSocket[] = [];

class FakeSocket {
    static OPEN = 1;
    readyState = 1;
    sent: { type: string; payload: Record<string, unknown> }[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
        sockets.push(this);
        queueMicrotask(() => this.onopen?.());
    }

    send(raw: string) {
        this.sent.push(JSON.parse(raw));
    }

    close() {}
}

function renderLive(path: string, isOrganizer: boolean) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/live/:sessionId"
                    element={<LiveQuiz isOrganizer={isOrganizer} />}
                />
            </Routes>
        </MemoryRouter>
    );
}

async function firstJoinMessage() {
    await waitFor(() => expect(sockets[0]?.sent.length).toBeGreaterThan(0));
    return sockets[0]!.sent[0];
}

beforeEach(() => {
    sockets.length = 0;
    localStorage.clear();
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
    }));
    useAuthStore.setState({
        user: { id: 'user-1', name: 'Host', email: 'host@example.com' },
        token: 'login-token',
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useAuthStore.setState({ user: null, token: null });
});

describe('LiveQuiz join message', () => {
    it('sends the login token when the host joins as organizer', async () => {
        renderLive('/live/session-1', true);

        const join = await firstJoinMessage();

        expect(join.type).toBe('join');
        expect(join.payload).toMatchObject({
            sessionId: 'session-1',
            role: 'ORGANIZER',
            token: 'login-token',
        });
    });

    it('does not send the login token when a participant joins', async () => {
        localStorage.setItem('rexial:participant:session-1', 'participant-1');
        localStorage.setItem('rexial:username:session-1', 'Sam');
        renderLive('/live/session-1', false);

        const join = await firstJoinMessage();

        expect(join.payload).toMatchObject({
            sessionId: 'session-1',
            role: 'PARTICIPANT',
            participantId: 'participant-1',
        });
        expect(join.payload.token).toBeUndefined();
        expect(JSON.stringify(join)).not.toContain('login-token');
    });
});

function deliver(type: string, payload: Record<string, unknown>) {
    act(() => sockets[0]!.onmessage?.({ data: JSON.stringify({ type, payload }) }));
}

function dropConnection() {
    act(() => {
        sockets[0]!.readyState = 3;
        sockets[0]!.onclose?.();
    });
}

function sentOfType(type: string) {
    return sockets[0]!.sent.filter((message) => message.type === type);
}

const question = {
    id: 'q1',
    text: 'Capital of France?',
    timeLimit: 20,
    answers: [
        { id: 'a1', text: 'Paris' },
        { id: 'a2', text: 'Rome' },
    ],
};

describe('LiveQuiz on a dropped connection', () => {
    async function joinAsParticipant() {
        localStorage.setItem('rexial:participant:session-1', 'participant-1');
        renderLive('/live/session-1', false);
        await firstJoinMessage();
        deliver('quiz:question', { question });
    }

    it('sends the answer and marks it chosen while connected', async () => {
        const user = userEvent.setup();
        await joinAsParticipant();

        await user.click(screen.getByRole('button', { name: 'Paris' }));

        expect(sentOfType('quiz:submit-answer')).toHaveLength(1);
        expect(sentOfType('quiz:submit-answer')[0]!.payload).toMatchObject({ answerId: 'a1' });
        expect(screen.getByRole('button', { name: 'Paris' })).toBeDisabled();
    });

    it('refuses an answer the socket cannot send and says why', async () => {
        const user = userEvent.setup();
        await joinAsParticipant();
        // Closed, but onclose has not fired yet: the banner still thinks we
        // are connected, so only the send itself can catch it.
        sockets[0]!.readyState = 3;

        await user.click(screen.getByRole('button', { name: 'Paris' }));

        expect(sentOfType('quiz:submit-answer')).toHaveLength(0);
        expect(screen.getByRole('button', { name: 'Paris' })).toBeEnabled();
        expect(screen.getByRole('alert')).toHaveTextContent('your answer was not sent');
    });

    it('disables the answers with a reason once the connection is lost', async () => {
        await joinAsParticipant();

        dropConnection();

        expect(screen.getByRole('button', { name: 'Paris' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Rome' })).toBeDisabled();
        expect(screen.getByRole('alert')).toHaveTextContent('answers cannot be sent');
    });
});

describe('LiveQuiz host controls on a dropped connection', () => {
    async function joinAsHost() {
        renderLive('/live/session-1', true);
        await firstJoinMessage();
        deliver('participants:sync', { participants: [{ id: 'p1', name: 'Sam' }] });
    }

    it('disables Start Game with a reason once the connection is lost', async () => {
        await joinAsHost();
        expect(screen.getByRole('button', { name: 'Start Game' })).toBeEnabled();

        dropConnection();

        expect(screen.getByRole('button', { name: 'Start Game' })).toBeDisabled();
        expect(screen.getByRole('alert')).toHaveTextContent('the game can be started once the connection is back');
    });

    it('does not skip a question when Next could not be sent', async () => {
        const user = userEvent.setup();
        await joinAsHost();
        deliver('quiz:leaderboard', { leaderboard: [] });
        const next = () => screen.getByRole('button', { name: 'Next Question' });

        await user.click(next());
        sockets[0]!.readyState = 3;
        await user.click(next());

        expect(sentOfType('quiz:next-question')).toHaveLength(1);
        expect(screen.getByRole('alert')).toHaveTextContent('the next question was not sent');

        sockets[0]!.readyState = 1;
        await user.click(next());

        expect(sentOfType('quiz:next-question').map((m) => m.payload.questionIndex)).toEqual([1, 2]);
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('LiveQuiz host start countdown', () => {
    it('cancels the first-question send when the host leaves', async () => {
        const view = renderLive('/live/session-1', true);
        await firstJoinMessage();
        vi.useFakeTimers();
        deliver('quiz:start', {});

        view.unmount();
        act(() => vi.advanceTimersByTime(3000));

        expect(sentOfType('quiz:next-question')).toHaveLength(0);
    });

    it('does not send the first question to a closed socket', async () => {
        renderLive('/live/session-1', true);
        await firstJoinMessage();
        vi.useFakeTimers();
        deliver('quiz:start', {});
        sockets[0]!.readyState = 3;

        act(() => vi.advanceTimersByTime(3000));

        expect(sentOfType('quiz:next-question')).toHaveLength(0);
    });
});

describe('LiveQuiz final leaderboard', () => {
    function rankedPlayers(count: number) {
        return Array.from({ length: count }, (_, index) => ({
            id: `participant-${index + 1}`,
            username: `Player ${index + 1}`,
            score: count - index,
            totalTimeMs: index,
        }));
    }

    it('shows the full-list rank and score for a participant outside the top 30', async () => {
        localStorage.setItem('rexial:participant:session-1', 'participant-35');
        renderLive('/live/session-1', false);
        await firstJoinMessage();
        deliver('quiz:leaderboard', { leaderboard: rankedPlayers(35) });
        deliver('quiz:ended', {});

        expect(await screen.findByText('Showing the top 30 of 35 players')).toBeInTheDocument();
        expect(screen.getByText('#35')).toBeInTheDocument();
        expect(screen.getByText('You')).toBeInTheDocument();
        expect(screen.getByText('1 pts')).toBeInTheDocument();
    });

    it('highlights a participant whose row is already in the visible top 30', async () => {
        localStorage.setItem('rexial:participant:session-1', 'participant-17');
        renderLive('/live/session-1', false);
        await firstJoinMessage();
        deliver('quiz:leaderboard', { leaderboard: rankedPlayers(35) });
        deliver('quiz:ended', {});

        const player = await screen.findByText('Player 17');
        expect(player.closest('div[class*="ring-2"]')).not.toBeNull();
    });
});

describe('LiveQuiz polling integration', () => {
    it('shows Create Poll button for organizer and not for participant', async () => {
        const view = renderLive('/live/session-1', true);
        await firstJoinMessage();
        expect(screen.getByRole('button', { name: /Create Poll/i })).toBeInTheDocument();
        view.unmount();

        // Switch to participant
        localStorage.setItem('rexial:participant:session-2', 'participant-1');
        renderLive('/live/session-2', false);
        await waitFor(() => expect(sockets[1]?.sent.length).toBeGreaterThan(0));
        expect(screen.queryByRole('button', { name: /Create Poll/i })).not.toBeInTheDocument();
    });

    it('organizer can open modal and launch poll', async () => {
        const user = userEvent.setup();
        renderLive('/live/session-1', true);
        await firstJoinMessage();

        await user.click(screen.getByRole('button', { name: /Create Poll/i }));
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.type(screen.getByLabelText(/Poll Question \/ Prompt/i), 'Enjoying the quiz?');
        const optionInputs = screen.getAllByPlaceholderText(/Option/i);
        await user.type(optionInputs[0]!, 'Yes');
        await user.type(optionInputs[1]!, 'No');

        await user.click(screen.getByRole('button', { name: /Launch Poll/i }));

        const pollCreateMessages = sentOfType('poll:create');
        expect(pollCreateMessages).toHaveLength(1);
        expect(pollCreateMessages[0]!.payload).toMatchObject({
            sessionId: 'session-1',
            question: 'Enjoying the quiz?',
            options: ['Yes', 'No'],
        });
    });

    it('renders active poll and allows participant to vote', async () => {
        const user = userEvent.setup();
        localStorage.setItem('rexial:participant:session-1', 'participant-1');
        renderLive('/live/session-1', false);
        await firstJoinMessage();

        deliver('poll:started', {
            poll: {
                id: 'poll-100',
                sessionId: 'session-1',
                question: 'Live mid-question poll?',
                status: 'ACTIVE',
                isRecorded: false,
                totalVotes: 0,
                createdAt: Date.now(),
                options: [
                    { id: 'opt-yes', text: 'Yes definitely', order: 0, voteCount: 0, percentage: 0 },
                    { id: 'opt-no', text: 'No', order: 1, voteCount: 0, percentage: 0 },
                ],
            },
        });

        expect(await screen.findByText('Live mid-question poll?')).toBeInTheDocument();
        const voteBtn = screen.getByRole('button', { name: /Yes definitely/i });
        await user.click(voteBtn);

        const voteMessages = sentOfType('poll:vote');
        expect(voteMessages).toHaveLength(1);
        expect(voteMessages[0]!.payload).toMatchObject({
            sessionId: 'session-1',
            pollId: 'poll-100',
            optionId: 'opt-yes',
            participantId: 'participant-1',
        });
    });

    it('organizer can record the poll result at the moment', async () => {
        const user = userEvent.setup();
        renderLive('/live/session-1', true);
        await firstJoinMessage();

        deliver('poll:started', {
            poll: {
                id: 'poll-200',
                sessionId: 'session-1',
                question: 'Rate this question difficulty',
                status: 'ACTIVE',
                isRecorded: false,
                totalVotes: 5,
                createdAt: Date.now(),
                options: [
                    { id: 'opt-easy', text: 'Easy', order: 0, voteCount: 4, percentage: 80 },
                    { id: 'opt-hard', text: 'Hard', order: 1, voteCount: 1, percentage: 20 },
                ],
            },
        });

        expect(await screen.findByText('Rate this question difficulty')).toBeInTheDocument();
        const recordBtn = screen.getByRole('button', { name: /Record Result/i });
        await user.click(recordBtn);

        const recordMessages = sentOfType('poll:record');
        expect(recordMessages).toHaveLength(1);
        expect(recordMessages[0]!.payload).toMatchObject({
            sessionId: 'session-1',
            pollId: 'poll-200',
        });

        deliver('poll:recorded', {
            pollId: 'poll-200',
            recordedAt: Date.now(),
            poll: {
                id: 'poll-200',
                sessionId: 'session-1',
                question: 'Rate this question difficulty',
                status: 'ACTIVE',
                isRecorded: true,
                recordedAt: Date.now(),
                totalVotes: 5,
                createdAt: Date.now(),
                options: [
                    { id: 'opt-easy', text: 'Easy', order: 0, voteCount: 4, percentage: 80 },
                    { id: 'opt-hard', text: 'Hard', order: 1, voteCount: 1, percentage: 20 },
                ],
            },
        });

        expect(await screen.findByText(/Poll result recorded successfully!/i)).toBeInTheDocument();
        expect(screen.getByText(/^Recorded/i)).toBeInTheDocument();
    });
});


