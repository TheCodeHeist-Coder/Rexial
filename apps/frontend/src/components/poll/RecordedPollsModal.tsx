import { BiPoll, BiX } from "react-icons/bi";
import RecordedPollsList from "./RecordedPollsList";
import type { Poll } from "./types";

interface RecordedPollsModalProps {
  isOpen: boolean;
  onClose: () => void;
  polls: Poll[];
}

export default function RecordedPollsModal({
  isOpen,
  onClose,
  polls,
}: RecordedPollsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorded-polls-title"
      className="fixed inset-0 z-100 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    >
      <div className="bg-[#0c0c0e] border border-pink-500/40 shadow-2xl shadow-pink-900/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 relative text-gray-200 overflow-hidden my-8">
        {/* Top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 bg-pink-600/15 blur-3xl pointer-events-none rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-pink-600/30 to-pink-900/40 border border-pink-500/40 flex items-center justify-center text-pink-400">
              <BiPoll className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="recorded-polls-title"
                className="text-xl sm:text-2xl font-bold font-special bg-clip-text text-transparent bg-linear-to-r from-pink-400 to-pink-600 tracking-wider"
              >
                Recorded Polls
              </h2>
              <p className="text-xs text-zinc-400 font-secondary">
                {polls.length} {polls.length === 1 ? "poll recorded" : "polls recorded"} this session
              </p>
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

        {/* Content */}
        <RecordedPollsList
          polls={polls}
          className="max-h-[60vh] overflow-y-auto pr-1"
        />

        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-zinc-300 hover:text-white border border-zinc-700 hover:bg-zinc-800/40 text-sm font-secondary transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
