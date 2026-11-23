import { useState, useEffect } from "react";
import { BiCheckCircle, BiSave, BiStop, BiX } from "react-icons/bi";
import { LuCheck, LuChevronDown, LuChevronUp, LuClock, LuUsers } from "react-icons/lu";
import type { Poll } from "./types";

interface ActivePollOverlayProps {
  poll: Poll;
  isOrganizer: boolean;
  participantId?: string;
  onVote: (optionId: string) => void;
  onEndPoll: () => void;
  onRecordPoll: () => void;
  onDismissPoll: () => void;
  isConnected: boolean;
}

export default function ActivePollOverlay({
  poll,
  isOrganizer,
  onVote,
  onEndPoll,
  onRecordPoll,
  onDismissPoll,
  isConnected,
}: ActivePollOverlayProps) {
  const [minimized, setMinimized] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const hasVoted = Boolean(poll.votedOptionId);
  const isEnded = poll.status === "ENDED";
  const showResults = isOrganizer || hasVoted || isEnded;

  // Countdown timer if duration was specified
  useEffect(() => {
    if (!poll.duration || isEnded) {
      setSecondsRemaining(null);
      return;
    }

    const elapsed = Math.floor((Date.now() - poll.createdAt) / 1000);
    const initialRemaining = Math.max(0, poll.duration - elapsed);
    setSecondsRemaining(initialRemaining);

    if (initialRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [poll.createdAt, poll.duration, isEnded]);

  // Find leading option
  const maxVotes = Math.max(...poll.options.map((o) => o.voteCount), 0);

  // Minimized compact pill view
  if (minimized) {
    return (
      <div
        className="fixed top-20 right-4 sm:right-8 z-90 bg-[#0c0c0e]/95 border border-pink-500/50 shadow-xl shadow-pink-900/30 rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md cursor-pointer transition-all hover:scale-105"
        onClick={() => setMinimized(false)}
        role="region"
        aria-label="Active Poll Minimized"
      >
        <span className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isEnded ? 'bg-zinc-400' : 'bg-pink-400'} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-3 w-3 ${isEnded ? 'bg-zinc-500' : 'bg-pink-500'}`} />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-bold font-secondary text-pink-400 tracking-wider uppercase">
            {isEnded ? "Poll Ended" : "Live Poll"}
          </span>
          <span className="text-xs text-zinc-300 font-secondary max-w-[180px] sm:max-w-[240px] truncate">
            {poll.question}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-secondary border-l border-white/10 pl-2">
          <LuUsers className="w-3.5 h-3.5 text-pink-400" />
          <span>{poll.totalVotes}</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMinimized(false);
          }}
          className="text-zinc-400 hover:text-white p-1"
          aria-label="Expand poll"
        >
          <LuChevronDown className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Live Poll"
      className="fixed inset-0 z-90 pointer-events-none flex items-center justify-center p-4 sm:p-6"
    >
      <div className="pointer-events-auto bg-[#0a0a0c]/95 border border-pink-500/40 shadow-2xl shadow-pink-950/60 rounded-3xl max-w-xl w-full p-5 sm:p-7 relative text-gray-200 backdrop-blur-xl transition-all animate-scale-up">
        {/* Top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-24 bg-pink-600/15 blur-3xl pointer-events-none rounded-full" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isEnded ? "bg-zinc-400" : "bg-pink-400"
                } opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isEnded ? "bg-zinc-500" : "bg-pink-500"
                }`}
              />
            </span>
            <span className="text-xs sm:text-sm font-bold font-secondary tracking-widest uppercase bg-clip-text text-transparent bg-linear-to-r from-pink-400 to-pink-600">
              {isEnded ? "Poll Closed" : "Live Poll"}
            </span>

            {typeof poll.questionIndex === "number" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-secondary border border-white/5">
                Q#{poll.questionIndex + 1}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {secondsRemaining !== null && !isEnded && (
              <span className="flex items-center gap-1 text-xs font-secondary font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                <LuClock className="w-3.5 h-3.5" /> {secondsRemaining}s
              </span>
            )}

            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-secondary">
              <LuUsers className="w-3.5 h-3.5 text-pink-400" />
              <span>
                {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              title="Minimize poll"
              aria-label="Minimize poll"
            >
              <LuChevronUp className="w-4 h-4" />
            </button>

            {isOrganizer && (
              <button
                type="button"
                onClick={onDismissPoll}
                className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Dismiss poll for room"
                aria-label="Dismiss poll for room"
              >
                <BiX className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Poll Question */}
        <h3 className="text-lg sm:text-2xl font-bold font-secondary text-white tracking-wide text-center mb-6 px-2 leading-snug">
          {poll.question}
        </h3>

        {/* Options / Results */}
        <div className="space-y-3 mb-6" role="group" aria-label="Poll options">
          {poll.options.map((option) => {
            const isVotedByMe = poll.votedOptionId === option.id;
            const isLeader = maxVotes > 0 && option.voteCount === maxVotes;

            if (showResults) {
              return (
                <div
                  key={option.id}
                  className={`relative overflow-hidden rounded-2xl border p-3.5 transition-all ${
                    isVotedByMe
                      ? "border-pink-500/70 bg-pink-950/20 ring-1 ring-pink-500/50 shadow-md shadow-pink-900/30"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                  }`}
                >
                  {/* Background progress fill bar */}
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-2xl opacity-20 ${
                      isLeader
                        ? "bg-linear-to-r from-pink-600 via-pink-500 to-rose-400"
                        : "bg-linear-to-r from-zinc-600 to-zinc-500"
                    }`}
                    style={{ width: `${option.percentage}%` }}
                  />

                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm sm:text-base font-secondary font-medium text-gray-200 truncate">
                        {option.text}
                      </span>
                      {isVotedByMe && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-secondary font-bold text-pink-300 bg-pink-500/20 border border-pink-500/40 px-2 py-0.5 rounded-full shrink-0">
                          <LuCheck className="w-3 h-3 text-pink-400" /> Your Vote
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs text-zinc-400 font-secondary">
                        {option.voteCount} {option.voteCount === 1 ? "vote" : "votes"}
                      </span>
                      <span
                        className={`text-base sm:text-lg font-special font-bold min-w-[42px] text-right ${
                          isLeader ? "text-pink-400" : "text-zinc-300"
                        }`}
                      >
                        {option.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal mini bar underneath */}
                  <div className="relative mt-2 h-1.5 w-full bg-zinc-800/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isLeader
                          ? "bg-linear-to-r from-pink-600 to-pink-400"
                          : "bg-zinc-600"
                      }`}
                      style={{ width: `${option.percentage}%` }}
                    />
                  </div>
                </div>
              );
            }

            // Voting Mode for Participant (Not yet voted)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onVote(option.id)}
                disabled={!isConnected || isEnded}
                className="w-full text-left p-4 rounded-2xl border-2 border-pink-700/40 bg-zinc-900/60 hover:bg-pink-950/30 hover:border-pink-500 text-gray-200 hover:text-white font-secondary text-base sm:text-lg font-bold transition-all duration-200 cursor-pointer active:scale-98 shadow-sm hover:shadow-pink-900/30 disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span>{option.text}</span>
                  <span className="text-xs uppercase tracking-wider font-secondary text-pink-400 font-semibold border border-pink-500/30 px-2.5 py-1 rounded-full">
                    Vote
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Voting status / Notice for participant */}
        {!isOrganizer && (
          <div className="text-center">
            {hasVoted ? (
              <p className="text-xs font-secondary text-zinc-400 tracking-wide">
                ✓ You voted. Live results update automatically as others vote.
              </p>
            ) : isEnded ? (
              <p className="text-xs font-secondary text-zinc-500 tracking-wide">
                This poll has closed.
              </p>
            ) : (
              <p className="text-xs font-secondary text-pink-400/90 tracking-wide">
                Tap an option above to submit your vote!
              </p>
            )}
          </div>
        )}

        {/* Organizer Controls */}
        {isOrganizer && (
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Record Result Button */}
              {poll.isRecorded ? (
                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-secondary font-bold">
                  <BiCheckCircle className="w-4 h-4" />
                  <span>
                    Recorded{" "}
                    {poll.recordedAt
                      ? new Date(poll.recordedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onRecordPoll}
                  disabled={!isConnected}
                  className="px-4 py-2 rounded-xl bg-linear-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-secondary font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Save poll result into database permanently"
                >
                  <BiSave className="w-4 h-4" /> Record Result
                </button>
              )}

              {/* End Poll Button */}
              {!isEnded && (
                <button
                  type="button"
                  onClick={onEndPoll}
                  disabled={!isConnected}
                  className="px-3.5 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-zinc-900 text-zinc-300 hover:text-white font-secondary text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <BiStop className="w-4 h-4 text-red-400" /> End Poll
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onDismissPoll}
              disabled={!isConnected}
              className="px-4 py-2 rounded-xl text-xs font-secondary text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800/40 transition-all cursor-pointer"
            >
              Close & Dismiss
            </button>
          </div>
        )}

        {/* Participant close if ended */}
        {!isOrganizer && isEnded && (
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-center">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="px-4 py-1.5 rounded-xl text-xs font-secondary text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800/40 transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
