import { BiPoll, BiX } from "react-icons/bi";
import { LuClock, LuUsers } from "react-icons/lu";
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
        {polls.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl p-6">
            <BiPoll className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-base font-bold font-secondary text-zinc-400 mb-1">
              No polls recorded yet
            </h4>
            <p className="text-xs text-zinc-500 font-secondary max-w-md mx-auto">
              Create a poll during any question and click &quot;Record Result&quot; to save its outcome here permanently.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {polls.map((poll, idx) => {
              const maxVotes = Math.max(...poll.options.map((o) => o.voteCount), 0);
              const formattedDate = poll.recordedAt || poll.createdAt
                ? new Date(poll.recordedAt || poll.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;

              return (
                <div
                  key={poll.id || idx}
                  className="bg-zinc-900/60 border border-pink-900/30 rounded-2xl p-5 hover:border-pink-600/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-pink-400 font-special uppercase">
                          Poll #{polls.length - idx}
                        </span>
                        {typeof poll.questionIndex === "number" && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-secondary border border-white/5">
                            Q#{poll.questionIndex + 1}
                          </span>
                        )}
                        {formattedDate && (
                          <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-secondary">
                            <LuClock className="w-3 h-3" /> {formattedDate}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base sm:text-lg font-bold font-secondary text-white">
                        {poll.question}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-pink-950/40 border border-pink-700/30 text-xs font-secondary text-pink-300 shrink-0">
                      <LuUsers className="w-3.5 h-3.5 text-pink-400" />
                      <span>{poll.totalVotes} votes</span>
                    </div>
                  </div>

                  {/* Options breakdown */}
                  <div className="space-y-2 mt-4">
                    {poll.options.map((opt) => {
                      const isLeader = maxVotes > 0 && opt.voteCount === maxVotes;
                      return (
                        <div
                          key={opt.id}
                          className="relative overflow-hidden rounded-xl bg-zinc-950/60 border border-zinc-800 p-2.5"
                        >
                          <div
                            className={`absolute inset-y-0 left-0 opacity-15 rounded-xl ${
                              isLeader
                                ? "bg-linear-to-r from-pink-600 to-rose-400"
                                : "bg-zinc-600"
                            }`}
                            style={{ width: `${opt.percentage}%` }}
                          />

                          <div className="relative z-10 flex items-center justify-between text-xs sm:text-sm">
                            <span className="font-secondary text-zinc-300 font-medium">
                              {opt.text}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 text-xs font-secondary">
                                {opt.voteCount}
                              </span>
                              <span
                                className={`font-special font-bold min-w-[36px] text-right ${
                                  isLeader ? "text-pink-400" : "text-zinc-400"
                                }`}
                              >
                                {opt.percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
