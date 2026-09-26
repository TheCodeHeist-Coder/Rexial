import { useState } from 'react';
import { BiSend } from 'react-icons/bi';
import { chat, genaiErrorMessage, isCancelled } from '../../services/genaiApi';
import AiProgress from './AiProgress';
import { useAiRequest } from './useAiRequest';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    text: string;
}

let nextMessageId = 1;

// General AI assistant for brainstorming quiz content. It searches the web
// when a question needs current information. Each message is answered on
// its own; the service does not keep conversation memory.
function AssistantTab() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [error, setError] = useState('');

    const request = useAiRequest();

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        const text = input.trim();

        if (!text) return;

        setError('');
        setInput('');
        setMessages((prev) => [...prev, { id: nextMessageId++, role: 'user', text }]);

        try {
            const reply = await request.run((options) => chat(text, options));

            setMessages((prev) => [
                ...prev,
                { id: nextMessageId++, role: 'assistant', text: reply },
            ]);
        } catch (err) {
            if (!isCancelled(err)) {
                setError(genaiErrorMessage(err, 'The assistant failed to reply.'));
            }
        }
    };

    return (
        <div>
            {messages.length === 0 ? (
                <p className="text-sm text-zinc-500 font-secondary tracking-wide mb-4">
                    Brainstorm quiz ideas, check facts, or ask about recent events. The
                    assistant searches the web when it needs current information. Each
                    message is answered on its own, so include the context you need.
                </p>
            ) : (
                <div className="mb-4 space-y-3 max-h-96 overflow-y-auto pr-1">
                    {messages.map((m) => (
                        <div
                            key={m.id}
                            data-testid={`message-${m.role}`}
                            className={`rounded-xl py-3 px-4 font-secondary text-sm whitespace-pre-wrap leading-relaxed ${
                                m.role === 'user'
                                    ? 'ml-12 bg-purple-600/20 border border-purple-700/40 text-purple-100'
                                    : 'mr-12 bg-zinc-900/60 border border-gray-800/60 text-zinc-300'
                            }`}
                        >
                            {m.text}
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={handleSend} className="flex gap-3">
                <input
                    type="text"
                    aria-label="Message the assistant"
                    placeholder="e.g. Give me 5 fun facts about the solar system"
                    className="flex-1 py-3 px-5 font-secondary outline-none border border-purple-800/50 rounded-xl text-gray-200 bg-transparent"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={request.busy}
                />
                <button
                    type="submit"
                    disabled={request.busy || !input.trim()}
                    aria-label="Send"
                    className="flex items-center justify-center py-3 px-5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-600/50 text-purple-300 cursor-pointer active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <BiSend className="w-4 h-4" />
                </button>
                {messages.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setMessages([])}
                        disabled={request.busy}
                        className="text-xs font-secondary font-bold tracking-wider text-zinc-400 hover:text-zinc-300 cursor-pointer disabled:opacity-40"
                    >
                        Clear
                    </button>
                )}
            </form>

            {request.busy && (
                <AiProgress
                    label="Thinking"
                    uploadPercent={null}
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
        </div>
    );
}

export default AssistantTab;
