import { useState } from 'react';
import { BiX } from 'react-icons/bi';
import { BsStars } from 'react-icons/bs';
import type { GeneratedQuestion } from '../services/genaiApi';
import AskPdfTab from './ai/AskPdfTab';
import AssistantTab from './ai/AssistantTab';
import GenerateQuizTab from './ai/GenerateQuizTab';
import PdfDropzone from './ai/PdfDropzone';

interface Props {
    // Texts of questions already in the quiz, so the AI does not repeat them.
    existingQuestions: string[];
    // Persists one question; the parent owns the quiz API call.
    onSave: (question: GeneratedQuestion, timeLimit: number) => Promise<void>;
    onSaved: () => void;
    onClose: () => void;
}

type Tab = 'generate' | 'ask' | 'assistant';

const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'generate', label: 'Generate quiz' },
    { id: 'ask', label: 'Ask the PDF' },
    { id: 'assistant', label: 'Assistant' },
];

// All tabs stay mounted so switching tabs, or hiding the panel, keeps
// unsaved drafts, answers and chat history.
function AiQuizGenerator({ existingQuestions, onSave, onClose, onSaved }: Props) {
    const [tab, setTab] = useState<Tab>('generate');
    const [file, setFile] = useState<File | null>(null);

    return (
        <div className="glass-card py-8 px-10 mt-6 bg-zinc-900/40 border border-purple-800/40 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
                <BsStars className="w-5 h-5 text-purple-400" />
                <h3 className="font-secondary font-extrabold tracking-wider text-lg text-gray-200">
                    Generate with AI
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close AI panel"
                    title="Close (your drafts are kept)"
                    className="ml-auto text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                    <BiX className="w-6 h-6" />
                </button>
            </div>

            <div role="tablist" className="flex gap-2 mb-6 border-b border-white/10">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`py-2 px-4 -mb-px border-b-2 font-secondary font-bold tracking-wider text-sm cursor-pointer transition-colors ${
                            tab === t.id
                                ? 'border-purple-400 text-purple-200'
                                : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab !== 'assistant' && (
                <div className="mb-6">
                    <PdfDropzone file={file} onChange={setFile} />
                </div>
            )}

            <div role="tabpanel" hidden={tab !== 'generate'}>
                <GenerateQuizTab
                    file={file}
                    existingQuestions={existingQuestions}
                    onSave={onSave}
                    onSaved={onSaved}
                    onClose={onClose}
                />
            </div>
            <div role="tabpanel" hidden={tab !== 'ask'}>
                <AskPdfTab file={file} />
            </div>
            <div role="tabpanel" hidden={tab !== 'assistant'}>
                <AssistantTab />
            </div>
        </div>
    );
}

export default AiQuizGenerator;
