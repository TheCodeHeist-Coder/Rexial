import { useState } from "react";
import { BiPoll, BiPlus, BiTrash, BiX } from "react-icons/bi";
import { LuSparkles, LuTimer } from "react-icons/lu";
import type { PollPreset } from "./types";

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    question: string;
    options: string[];
    duration?: number;
  }) => void;
  currentQuestionText?: string;
  questionIndex?: number;
}

const PRESETS: PollPreset[] = [
  {
    label: "Yes / No",
    icon: "👍",
    question: "Quick poll: Do you agree with this concept?",
    options: ["Yes", "No"],
  },
  {
    label: "Understanding",
    icon: "💡",
    question: "How well did you understand this question?",
    options: ["Understood completely", "Partially understood", "Need explanation"],
  },
  {
    label: "Difficulty",
    icon: "⚡",
    question: "What did you think of the difficulty?",
    options: ["Too Easy", "Just Right", "Very Tough"],
  },
  {
    label: "A / B / C / D",
    icon: "🔤",
    question: "Which option seemed most plausible to you?",
    options: ["Option A", "Option B", "Option C", "Option D"],
  },
];

const DURATIONS = [
  { label: "No Timer", value: undefined },
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "45s", value: 45 },
  { label: "60s", value: 60 },
];

export default function CreatePollModal({
  isOpen,
  onClose,
  onSubmit,
  currentQuestionText,
  questionIndex,
}: CreatePollModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string>("");

  if (!isOpen) return null;

  const handleApplyPreset = (preset: PollPreset) => {
    setQuestion(preset.question);
    setOptions([...preset.options]);
    setError("");
  };

  const handleUseQuestionAsPrompt = () => {
    if (currentQuestionText) {
      setQuestion(`Thoughts on: "${currentQuestionText}"?`);
      setOptions(["Agreed with correct answer", "Tricked by a distractor", "Guessed"]);
      setError("");
    }
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
    if (error) setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError("Please provide a question for the poll.");
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (cleanOptions.length < 2) {
      setError("Please provide at least 2 non-empty options.");
      return;
    }

    onSubmit({
      question: cleanQuestion,
      options: cleanOptions,
      duration,
    });

    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-poll-title"
      className="fixed inset-0 z-100 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    >
      <div className="bg-[#0c0c0e] border border-pink-500/40 shadow-2xl shadow-pink-900/40 rounded-3xl max-w-xl w-full p-6 sm:p-8 relative text-gray-200 overflow-hidden my-8">
        {/* Top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-20 bg-pink-600/15 blur-3xl pointer-events-none rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-pink-600/30 to-pink-900/40 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <BiPoll className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="create-poll-title"
                className="text-xl sm:text-2xl font-bold font-special bg-clip-text text-transparent bg-linear-to-r from-pink-400 to-pink-600 tracking-wider"
              >
                Create Live Poll
              </h2>
              {typeof questionIndex === "number" && (
                <p className="text-xs text-zinc-400 font-secondary">
                  During Question #{questionIndex + 1}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <BiX className="w-6 h-6" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-zinc-400 font-secondary tracking-wider font-semibold uppercase flex items-center gap-1.5">
              <LuSparkles className="w-3.5 h-3.5 text-pink-400" /> Quick Presets
            </label>
            {currentQuestionText && (
              <button
                type="button"
                onClick={handleUseQuestionAsPrompt}
                className="text-xs text-pink-400 hover:text-pink-300 font-secondary underline cursor-pointer"
              >
                Use current question context
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="px-3 py-1.5 rounded-xl border border-pink-700/30 bg-pink-950/20 hover:bg-pink-900/30 hover:border-pink-500/50 text-xs font-secondary text-pink-300 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Question Input */}
          <div>
            <label
              htmlFor="poll-question-input"
              className="block text-xs uppercase tracking-wider font-secondary font-bold text-zinc-400 mb-2"
            >
              Poll Question / Prompt *
            </label>
            <input
              id="poll-question-input"
              type="text"
              placeholder="e.g. Is this explanation clear?"
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (error) setError("");
              }}
              className="w-full bg-zinc-900/90 border border-pink-700/40 focus:border-pink-500 rounded-xl px-4 py-3 text-white placeholder-zinc-500 font-secondary text-base outline-none transition-all shadow-inner"
              maxLength={200}
            />
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-wider font-secondary font-bold text-zinc-400">
                Poll Options (Min 2, Max 6) *
              </label>
              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-xs text-pink-400 hover:text-pink-300 font-secondary font-bold flex items-center gap-1 cursor-pointer"
                >
                  <BiPlus className="w-4 h-4" /> Add Option
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-special font-bold text-pink-400 shrink-0">
                    #{idx + 1}
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    className="flex-1 bg-zinc-900/80 border border-zinc-700/60 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 font-secondary text-sm outline-none transition-all"
                    maxLength={80}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remove option"
                      aria-label={`Remove option ${idx + 1}`}
                    >
                      <BiTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs uppercase tracking-wider font-secondary font-bold text-zinc-400 mb-2 flex items-center gap-1.5">
              <LuTimer className="w-3.5 h-3.5 text-pink-400" /> Timer (Optional)
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-secondary transition-all cursor-pointer ${
                    duration === d.value
                      ? "bg-pink-600 text-white border-pink-400 shadow-md shadow-pink-600/30 font-bold"
                      : "border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-400 font-secondary mt-2">
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-zinc-400 hover:text-white border border-zinc-700/60 hover:bg-zinc-800/40 text-sm font-secondary transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary py-2.5 px-6 rounded-xl text-sm font-bold bg-linear-to-b from-pink-500 to-pink-700 hover:from-pink-600 hover:to-pink-800 text-black font-secondary tracking-wide shadow-lg shadow-pink-700/30 transition-all cursor-pointer active:scale-95"
            >
              Launch Poll 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
