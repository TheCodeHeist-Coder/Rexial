import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

vi.mock('../services/api', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('../components/BgBoss', () => ({
    default: () => null,
}));

vi.mock('../store/authStore', () => ({
    useAuthStore: () => ({ user: { name: 'Tester' }, logout: vi.fn() }),
}));

const { api } = await import('../services/api');

function renderDashboard() {
    render(
        <MemoryRouter>
            <Dashboard />
        </MemoryRouter>
    );

    return userEvent.setup();
}

beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.get).mockResolvedValue({
        data: { organizedQuizes: [], participated: [] },
    });
});

describe('Dashboard create-quiz modal', () => {
    it('renders exactly one create modal when opened', async () => {
        const user = renderDashboard();

        await user.click(screen.getByRole('button', { name: 'Create New Quiz' }));

        expect(screen.getAllByRole('heading', { name: 'Create New Quiz' })).toHaveLength(1);
        expect(screen.getAllByPlaceholderText('Enter quiz title...')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('keeps the Create button disabled and the title input required while the title is empty', async () => {
        const user = renderDashboard();

        await user.click(screen.getByRole('button', { name: 'Create New Quiz' }));

        const titleInput = screen.getByPlaceholderText('Enter quiz title...');
        expect(titleInput).toBeRequired();
        expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    });

    it('cannot submit the form twice in quick succession', async () => {
        let resolvePost: (value: unknown) => void = () => {};
        vi.mocked(api.post).mockImplementation(
            () => new Promise((resolve) => {
                resolvePost = resolve;
            })
        );

        const user = renderDashboard();

        await user.click(screen.getByRole('button', { name: 'Create New Quiz' }));
        await user.type(screen.getByPlaceholderText('Enter quiz title...'), 'My quiz');

        const createButton = screen.getByRole('button', { name: 'Create' });
        await user.click(createButton);

        // The request is in flight: the button is disabled and renamed.
        expect(api.post).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole('button', { name: 'Creating...' })).catch(() => {});

        expect(api.post).toHaveBeenCalledTimes(1);

        resolvePost({ data: { id: 'quiz-1' } });
    });
});
