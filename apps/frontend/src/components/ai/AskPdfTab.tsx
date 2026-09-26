import { useState } from 'react';
import { LuMessageSquareText } from 'react-icons/lu';
import { askPdf, genaiErrorMessage, isCancelled } from '../../services/genaiApi';
import AiProgress from './AiProgress';
import { useAiRequest } from './useAiRequest';

interface Props {
    file: File | null;
}

interface Exchange {
    id: number;
    question: string;
    answer: string;
}

let nextExchangeId = 1;

// Question answering over the uploaded PDF, handy for checking what a
// document covers before generating questions from it.
function AskPdfTab({ file }: Props) {
    const [question, setQuestion] = useState('');
    const [history, setHistory] = useState<Exchange[]>([]);
    const [error, setError] = useState('');

    const request = useAiRequest();

    const handleAsk = async (e: React.FormEvent) => {
        e.preventDefault();

        const asked = question.trim();

        if (!file) return setError('Choose a PDF first.');
        if (!asked) return setError('Type a question about the PDF.');

        setError('');

        try {
            const { answer } = await request.run((options) => askPdf(file, asked, options));

            setHistory((prev) => [{ id: nextExchangeId++, question: asked, answer }, ...prev]);
            setQuestion('');
        } catch (err) {
            if (!isCancelled(err)) {
                setError(genaiErrorMessage(err, 'Failed to answer the question.'));
            }
        }
    };

    return (
        <div>
            <form onSubmit={handleAsk} className="flex flex-col sm:flex-row gap-4">
                <input
                    type="text"
                    aria-label="Question about the PDF"
                    placeholder="e.g. What topics does this document cover?"
                    className="flex-1 py-3 px-5 font-secondary outline-none border border-purple-800/50 rounded-xl text-gray-200 bg-transparent"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={request.busy}
                />
                <button
                    type="submit"
                    disabled={request.busy || !file}
                    className="flex items-center justify-center gap-2 py-3 px-7 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-600/50 text-purple-300 font-secondary font-extrabold tracking-wider cursor-pointer active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    <LuMessageSquareText className="w-4 h-4" />
                    Ask
                </button>
            </form>

            {request.busy && (
                <AiProgress
                    label="Searching the PDF"
                    uploadPercent={request.uploadPercent}
                    elapsed={request.elapsed}
                    onCancel={request.cancel}
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

            <div className="mt-6 space-y-4">
                {history.map((item) => (
                    <div
                        key={item.id}
                        data-testid="exchange"
                        className="rounded-xl border border-purple-800/30 bg-zinc-900/40 py-4 px-5"
                    >
                        <p className="font-secondary font-bold text-purple-300 tracking-wide mb-2">
                            {item.question}
                        </p>
                        <p className="font-secondary text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {item.answer}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default AskPdfTab;
