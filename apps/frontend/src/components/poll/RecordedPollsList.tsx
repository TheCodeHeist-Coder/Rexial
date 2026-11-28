import { BiPoll } from "react-icons/bi";
import { LuClock, LuUsers } from "react-icons/lu";
import type { Poll } from "./types";

interface RecordedPollsListProps {
  polls: Poll[];
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function RecordedPollsList({
  polls,
  className = "",
  emptyTitle = "No polls recorded yet",
  emptyDescription = 'Create a poll during any question and click "Record Result" to save its outcome here permanently.',
}: RecordedPollsListProps) {
  if (polls.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl p-6">
        <BiPoll className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <h4 className="text-base font-bold font-secondary text-zinc-400 mb-1">
          {emptyTitle}
        </h4>
        <p className="text-xs text-zinc-500 font-secondary max-w-md mx-auto">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {polls.map((poll, idx) => {
        const maxVotes = Math.max(...poll.options.map((o) => o.voteCount), 0);
        const formattedDate =
          poll.recordedAt || poll.createdAt
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
                const percentage =
                  typeof opt.percentage === "number"
                    ? opt.percentage
                    : poll.totalVotes > 0
                      ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                      : 0;
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
                      style={{ width: `${percentage}%` }}
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
                          {percentage}%
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
  );
}
