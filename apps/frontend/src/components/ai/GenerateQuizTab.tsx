import { useState } from 'react';
import { BiTrash } from 'react-icons/bi';
import { BsStars } from 'react-icons/bs';
import { LuLoader, LuRefreshCw } from 'react-icons/lu';
import {
    generateQuiz,
    genaiErrorMessage,
    isCancelled,
    type Difficulty,
    type GeneratedQuestion,
    type QuizSettings,
} from '../../services/genaiApi';
import AiProgress from './AiProgress';
import { DIFFICULTY_STYLES } from './difficulty';
import { useAiRequest } from './useAiRequest';

// A generated question plus the local review state layered on top of it.
interface DraftQuestion extends GeneratedQuestion {
    id: number;
    selected: boolean;
}

interface Props {
    file: File | null;
    // Texts of questions already in the quiz, so the AI does not repeat them.
    existingQuestions: string[];
    // Persists one question; the parent owns the quiz API call.
    onSave: (question: GeneratedQuestion, timeLimit: number) => Promise<void>;
    onSaved: () => void;
    onClose: () => void;
}

const COUNTS = [3, 5, 10, 15, 20];
const DIFFICULTIES: Array<QuizSettings['difficulty']> = ['Mixed', 'Low', 'Medium', 'High'];
const TIME_PRESETS = [10, 15, 20, 30];
const MIN_TIME = 5;
const MAX_TIME = 300;

let nextDraftId = 1;

const toDraft = (q: GeneratedQuestion): DraftQuestion => ({
    ...q,
    id: nextDraftId++,
    selected: true,
});

const chip = (active: boolean) =>
    `py-1.5 px-3 rounded-lg border text-sm font-secondary font-bold tracking-wide cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
            ? 'bg-purple-600/40 border-purple-500 text-purple-100'
            : 'bg-transparent border-purple-800/50 text-zinc-400 hover:bg-purple-900/20'
    }`;

function GenerateQuizTab({ file, existingQuestions, onSave, onSaved, onClose }: Props) {
    const [count, setCount] = useState(5);
    const [difficulty, setDifficulty] = useState<QuizSettings['difficulty']>('Mixed');
    const [topic, setTopic] = useState('');
    const [timeLimit, setTimeLimit] = useState('15');

    const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
    const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const generation = useAiRequest();
    const regeneration = useAiRequest();

    const selectedCount = drafts.filter((d) => d.selected).length;
    const busy = generation.busy || regeneration.busy || saving;

    // Everything the model should avoid repeating: saved and pending questions.
    const knownTexts = () => [...existingQuestions, ...drafts.map((d) => d.text)];

    const updateDraft = (id: number, patch: Partial<DraftQuestion>) => {
        setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    };

    const setCorrect = (id: number, optIdx: number) => {
        setDrafts((prev) =>
            prev.map((d) =>
                d.id === id
                    ? {
                          ...d,
                          options: d.options.map((o, oi) => ({
                              ...o,
                              isCorrect: oi === optIdx,
                          })),
                      }
                    : d
            )
        );
    };

    const setOptionText = (id: number, optIdx: number, text: string) => {
        setDrafts((prev) =>
            prev.map((d) =>
                d.id === id
                    ? {
                          ...d,
                          options: d.options.map((o, oi) =>
                              oi === optIdx ? { ...o, text } : o
                          ),
                      }
                    : d
            )
        );
    };

    const handleGenerate = async () => {
        if (!file) return setError('Choose a PDF first.');

        setError('');

        try {
            const questions = await generation.run((options) =>
                generateQuiz(
                    file,
                    { count, difficulty, topic, exclude: knownTexts() },
                    options
                )
            );

            // appended, so generating again never throws away unsaved work
            setDrafts((prev) => [...prev, ...questions.map(toDraft)]);
        } catch (err) {
            if (!isCancelled(err)) {
                setError(genaiErrorMessage(err, 'Failed to generate questions.'));
            }
        }
    };

    const handleRegenerate = async (draft: DraftQuestion) => {
        if (!file) return setError('Choose the PDF again to regenerate questions.');

        setError('');
        setRegeneratingId(draft.id);

        try {
            const [replacement] = await regeneration.run((options) =>
                generateQuiz(
                    file,
                    {
                        count: 1,
                        difficulty: draft.difficulty,
                        topic,
                        exclude: knownTexts(),
                    },
                    options
                )
            );

            if (replacement) {
                setDrafts((prev) =>
                    prev.map((d) => (d.id === draft.id ? toDraft(replacement) : d))
                );
            }
        } catch (err) {
            if (!isCancelled(err)) {
                setError(genaiErrorMessage(err, 'Failed to regenerate the question.'));
            }
        } finally {
            setRegeneratingId(null);
        }
    };

    const handleSaveSelected = async () => {
        const chosen = drafts.filter((d) => d.selected);

        if (chosen.length === 0) return setError('Select at least one question.');

        const invalid = chosen.find(
            (q) => !q.text.trim() || q.options.some((o) => !o.text.trim())
        );

        if (invalid) return setError('Every question and option needs text.');

        const seconds = Number(timeLimit);

        if (!Number.isInteger(seconds) || seconds < MIN_TIME || seconds > MAX_TIME) {
            return setError(
                `Time per question must be a whole number from ${MIN_TIME} to ${MAX_TIME} seconds.`
            );
        }

        setSaving(true);
        setError('');

        let saved = 0;

        try {
            // Saved sequentially: the API takes one question per request,
            // and this keeps ordering stable in the quiz. Each question
            // leaves the list as soon as it is stored, so a retry after a
            // failure never saves it twice.
            for (const q of chosen) {
                await onSave(q, seconds);
                saved += 1;
                setDrafts((prev) => prev.filter((d) => d.id !== q.id));
            }

            onSaved();
            onClose();
        } catch {
            if (saved > 0) onSaved();

            setError(
                `Saved ${saved} of ${chosen.length} questions. The rest are still ` +
                    'below. Try adding them again.'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            {/* Settings */}
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex items-center gap-2" role="group" aria-label="Number of questions">
                        <span className="text-xs text-zinc-500 font-secondary tracking-widest font-bold w-20">
                            QUESTIONS
                        </span>
                        {COUNTS.map((n) => (
                            <button
                                key={n}
                                type="button"
                                aria-pressed={count === n}
                                onClick={() => setCount(n)}
                                disabled={busy}
                                className={chip(count === n)}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2" role="group" aria-label="Difficulty">
                        <span className="text-xs text-zinc-500 font-secondary tracking-widest font-bold w-20">
                            DIFFICULTY
                        </span>
                        {DIFFICULTIES.map((d) => (
                            <button
                                key={d}
                                type="button"
                                aria-pressed={difficulty === d}
                                onClick={() => setDifficulty(d)}
                                disabled={busy}
                                className={chip(difficulty === d)}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="text"
                        aria-label="Focus"
                        placeholder="Focus (optional), e.g. chapter 2 or key formulas"
                        className="flex-1 py-3 px-5 font-secondary outline-none border border-purple-800/50 rounded-xl text-gray-200 bg-transparent"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={busy}
                    />

                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={busy || !file}
                        className="flex items-center justify-center gap-2 py-3 px-7 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-600/50 text-purple-300 font-secondary font-extrabold tracking-wider cursor-pointer active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        <BsStars className="w-4 h-4" />
                        Generate {count} {count === 1 ? 'question' : 'questions'}
                    </button>
                </div>
            </div>

            {generation.busy && (
                <AiProgress
                    label="Reading the PDF and writing questions"
                    uploadPercent={generation.uploadPercent}
                    elapsed={generation.elapsed}
                    onCancel={generation.cancel}
                />
            )}

            {error && (
                <p
                    role="alert"
                    className="mt-4 text-sm text-rose-400 font-secondary tracking-wide border border-rose-800/40 bg-rose-900/10 rounded-lg py-3 px-4"
                >
                    {error}
                </p>
            )}

            {/* Review step */}
            {drafts.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <h4 className="font-secondary font-bold tracking-wider text-gray-300">
                                Review{' '}
                                <span className="text-purple-400">{selectedCount}</span> of{' '}
                                {drafts.length} selected
                            </h4>
                            <div className="flex items-center gap-3 text-xs font-secondary font-bold tracking-wider">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDrafts((prev) => prev.map((d) => ({ ...d, selected: true })))
                                    }
                                    className="text-purple-300 hover:text-purple-200 cursor-pointer"
                                >
                                    Select all
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDrafts((prev) => prev.map((d) => ({ ...d, selected: false })))
                                    }
                                    className="text-zinc-400 hover:text-zinc-300 cursor-pointer"
                                >
                                    Select none
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDrafts([])}
                                    disabled={busy}
                                    className="text-rose-400 hover:text-rose-300 cursor-pointer disabled:opacity-40"
                                >
                                    Discard all
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2" role="group" aria-label="Seconds per question">
                                {TIME_PRESETS.map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        aria-pressed={timeLimit === String(t)}
                                        onClick={() => setTimeLimit(String(t))}
                                        className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold cursor-pointer ${
                                            timeLimit === String(t)
                                                ? 'bg-green-600/30 border-green-500 text-green-200'
                                                : 'border-green-800/60 text-green-500 hover:bg-green-900/20'
                                        }`}
                                    >
                                        {t}s
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    aria-label="Seconds per question"
                                    min={MIN_TIME}
                                    max={MAX_TIME}
                                    className="text-center bg-green-800/20 outline-none border border-green-800 w-16 py-1.5 text-gray-50 font-extrabold rounded-lg"
                                    value={timeLimit}
                                    onChange={(e) => setTimeLimit(e.target.value)}
                                />
                                <span className="text-xs text-green-500 tracking-widest font-bold">
                                    SECS EACH
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleSaveSelected}
                                disabled={busy || selectedCount === 0}
                                className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-green-600/20 hover:bg-green-600/30 border border-green-600/40 text-green-300 font-secondary font-extrabold tracking-wider cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : `Add ${selectedCount} to Quiz`}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {drafts.map((q) => {
                            const regenerating = regeneratingId === q.id;

                            return (
                                <div
                                    key={q.id}
                                    data-testid="draft"
                                    className={`rounded-xl border py-5 px-6 transition-colors ${
                                        q.selected
                                            ? 'bg-zinc-900/50 border-purple-800/40'
                                            : 'bg-zinc-900/20 border-gray-800/40 opacity-50'
                                    } ${regenerating ? 'animate-pulse' : ''}`}
                                >
                                    <div className="flex items-start gap-4 mb-4">
                                        <input
                                            type="checkbox"
                                            aria-label="Include this question"
                                            checked={q.selected}
                                            onChange={(e) =>
                                                updateDraft(q.id, { selected: e.target.checked })
                                            }
                                            className="mt-2 w-4 h-4 accent-purple-500 cursor-pointer shrink-0"
                                        />

                                        <input
                                            type="text"
                                            aria-label="Question text"
                                            value={q.text}
                                            onChange={(e) => updateDraft(q.id, { text: e.target.value })}
                                            className="flex-1 bg-transparent border-b border-transparent hover:border-gray-700 focus:border-purple-600 outline-none font-secondary text-gray-200 tracking-wide font-semibold pb-1"
                                        />

                                        <select
                                            aria-label="Question difficulty"
                                            value={q.difficulty}
                                            onChange={(e) =>
                                                updateDraft(q.id, {
                                                    difficulty: e.target.value as Difficulty,
                                                })
                                            }
                                            className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 bg-zinc-900 cursor-pointer outline-none ${
                                                DIFFICULTY_STYLES[q.difficulty] ?? DIFFICULTY_STYLES.Medium
                                            }`}
                                        >
                                            <option value="Low">Low</option>
                                            <option value="Medium">Medium</option>
                                            <option value="High">High</option>
                                        </select>

                                        <button
                                            type="button"
                                            onClick={() => handleRegenerate(q)}
                                            disabled={busy}
                                            className="text-purple-300 hover:text-purple-200 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                            title="Regenerate this question"
                                            aria-label="Regenerate this question"
                                        >
                                            {regenerating ? (
                                                <LuLoader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <LuRefreshCw className="w-4 h-4" />
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setDrafts((prev) => prev.filter((d) => d.id !== q.id))
                                            }
                                            disabled={regenerating || saving}
                                            className="text-rose-400 hover:text-rose-300 cursor-pointer shrink-0 disabled:opacity-40"
                                            title="Discard this question"
                                            aria-label="Discard this question"
                                        >
                                            <BiTrash className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-3 pl-8">
                                        {q.options.map((opt, optIdx) => (
                                            <div
                                                key={optIdx}
                                                className={`flex items-center border rounded-lg overflow-hidden ${
                                                    opt.isCorrect
                                                        ? 'border-green-500/50 bg-green-500/5'
                                                        : 'border-gray-800/60 bg-white/5'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setCorrect(q.id, optIdx)}
                                                    title="Mark as the correct answer"
                                                    aria-label={`Mark option ${optIdx + 1} correct`}
                                                    aria-pressed={opt.isCorrect}
                                                    className={`w-10 self-stretch flex items-center justify-center cursor-pointer ${
                                                        opt.isCorrect
                                                            ? 'bg-green-500 text-gray-100 font-extrabold'
                                                            : 'hover:bg-white/5 text-zinc-600'
                                                    }`}
                                                >
                                                    {opt.isCorrect ? '✓' : ''}
                                                </button>
                                                <input
                                                    type="text"
                                                    aria-label={`Option ${optIdx + 1}`}
                                                    value={opt.text}
                                                    onChange={(e) =>
                                                        setOptionText(q.id, optIdx, e.target.value)
                                                    }
                                                    className="w-full bg-transparent px-3 py-2.5 font-secondary text-sm text-zinc-300 focus:outline-none"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default GenerateQuizTab;
