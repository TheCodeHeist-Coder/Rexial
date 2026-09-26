import type { Difficulty } from '../../services/genaiApi';

export const DIFFICULTY_STYLES: Record<Difficulty, string> = {
    Low: 'bg-green-500/10 text-green-400 border-green-500/20',
    Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    High: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};
