import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LuUserSearch } from "react-icons/lu";
import { getAvatar, getAvatarColor } from "../utils/Avatars";
import { BiCheckCircle, BiXCircle } from "react-icons/bi";
import BgBoss from "../components/BgBoss";
import { FaSpinner } from "react-icons/fa6";
import { MdViewInAr } from "react-icons/md";
import { participantTokenKey, streamingEnabled } from "../services/streamApi";

// The LiveKit client is most of a megabyte; only a live video quiz loads it.
const LiveStage = lazy(() => import("../components/live/LiveStage"));



const GameState = {
  WAITING: 'WAITING',
  STARTING: 'STARTING',
  QUESTION: 'QUESTION',
  RESULTS: 'RESULTS',
  LEADERBOARD: 'LEADERBOARD',
  ENDED: 'ENDED'
} as const;

type GameState = typeof GameState[keyof typeof GameState];

interface LiveQuizProps {
  isOrganizer?: boolean;
}


function LiveQuiz({ isOrganizer = false }: LiveQuizProps) {

  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { user, token } = useAuthStore();

  // location.state is gone after a reload, so fall back to what JoinQuiz
  // stored. Without this a participant who refreshed mid-quiz was treated as
  // never having joined and bounced back to /join, losing their place and
  // their score.
  const participantId = location.state?.participantId
    ?? (sessionId ? localStorage.getItem(`rexial:participant:${sessionId}`) : null)
    ?? undefined;
  const username = location.state?.username
    ?? (sessionId ? localStorage.getItem(`rexial:username:${sessionId}`) : null)
    ?? undefined;

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] =
    useState<'connected' | 'reconnecting' | 'failed'>('connected');
  // Set when a send was refused because the socket was not open, so the
  // user is told at the moment they tap rather than only by the banner.
  const [sendFailed, setSendFailed] = useState(false);
  const isConnected = connectionState === 'connected';
  const [gameState, setGameState] = useState<GameState>('WAITING');
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const [joinCode, setJoinCode] = useState('');
  // Set by the server on join: the host opened this lobby with live video.
  const [liveVideo, setLiveVideo] = useState(false);



  // How many in the room have answered the question in flight. Reset on each
  // new question so the previous one's tally never shows against a fresh one.
  const [answerProgress, setAnswerProgress] =
    useState<{ answered: number; total: number } | null>(null);
  // Read inside the socket handler, which closes over its first render: a
  // ref sees the question actually on screen, state would not.
  const currentQuestionIdRef = useRef<string | null>(null);

  // The few most recent answerers, shown as avatars popping onto the bar.
  // Capped because at 500 players every answer would otherwise mount a node,
  // and only the last handful are legible anyway.
  const [recentAnswerers, setRecentAnswerers] = useState<string[]>([]);
  const RECENT_AVATARS = 8;

  // Avatar sizes for the progress bar. Inline rather than Tailwind classes
  // because the leader is sized differently from the trail, so this tracks
  // the viewport directly. Mobile keeps the original sizes; a laptop or a
  // projector has the room for something readable across a hall.
  // Three steps rather than two: a projector or a large monitor has the room
  // for avatars that read across a hall, and the two-step version still
  // looked small on anything above a laptop.
  const [screenTier, setScreenTier] = useState<'sm' | 'md' | 'lg'>(() => {
    if (typeof window === 'undefined') return 'sm';
    if (window.matchMedia('(min-width: 1024px)').matches) return 'lg';
    if (window.matchMedia('(min-width: 640px)').matches) return 'md';
    return 'sm';
  });
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const mid = window.matchMedia('(min-width: 640px)');
    const update = () => setScreenTier(wide.matches ? 'lg' : mid.matches ? 'md' : 'sm');
    wide.addEventListener('change', update);
    mid.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      mid.removeEventListener('change', update);
    };
  }, []);
  const avatarLead = screenTier === 'lg' ? 76 : screenTier === 'md' ? 62 : 30;
  const avatarTrail = screenTier === 'lg' ? 62 : screenTier === 'md' ? 50 : 24;
  const avatarOverlap = screenTier === 'lg' ? -20 : screenTier === 'md' ? -16 : -9;

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [qIndex, setQIndex] = useState(0);


  // Scores are whole numbers 10..1 per question, so ties are common. The
  // server already ranks by score and then by total answer time; re-sorting
  // on score alone here would throw that tiebreak away and leave equal scores
  // in arbitrary order, so fall back to the same key it used.
  const sortedLeaderboard = [...leaderboard].sort(
    (a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      (a.totalTimeMs ?? Infinity) - (b.totalTimeMs ?? Infinity)
  );

  // Laid out 2nd - 1st - 3rd so the winner stands in the middle, the way a
  // real podium reads. Source order is the display order on desktop; on
  // mobile the row becomes a column, so `order` puts 1st back on top.
  const podium = [
    { rank: 2, player: sortedLeaderboard[1], order: 'order-2 sm:order-1' },
    { rank: 1, player: sortedLeaderboard[0], order: 'order-1 sm:order-2' },
    { rank: 3, player: sortedLeaderboard[2], order: 'order-3 sm:order-3' },
  ].filter((entry): entry is { rank: number; player: any; order: string } => Boolean(entry.player));

  // Everyone past the podium, capped: a 500-player session rendered the whole
  // board, so the end of a quiz was a page of names nobody reads.
  // Between questions the board is glanced at for a few seconds on a shared
  // screen, so it shows fewer and has to fit without scrolling. The final
  // board is read at leisure, so it shows more.
  const ROUND_LIMIT = 10;
  const FINAL_LIMIT = 30;
  const others = sortedLeaderboard.slice(3, FINAL_LIMIT);
  const hiddenCount = Math.max(0, sortedLeaderboard.length - FINAL_LIMIT);
  const roundHiddenCount = Math.max(0, sortedLeaderboard.length - ROUND_LIMIT);

  // Where this participant actually placed, found before the list is cut.
  // Without it someone who came 120th out of 500 finishes the quiz with no
  // idea how they did, having answered every question.
  const myIndex = participantId
    ? sortedLeaderboard.findIndex((p) => p?.id === participantId)
    : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const me = myIndex >= 0 ? sortedLeaderboard[myIndex] : null;
  // Only worth pinning a separate row when they are not already on screen.
  const isPlayerOffBoard = !isOrganizer && me !== null && myRank !== null;
  // Pin the viewer's own row only when the list they are looking at does not
  // already contain it; the two screens cut at different places.
  const showMyRank = isPlayerOffBoard && myRank! > FINAL_LIMIT;
  const showMyRoundRank = isPlayerOffBoard && myRank! > ROUND_LIMIT;


  // if participant is missing, kick them out
  useEffect(() => {
    if (!isOrganizer && !participantId) {
      navigate('/join');
      return;
    }


    let socket: WebSocket | null = null;
    let isMounted = true;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    // Lobby-only reconciliation for the host; cleared once the quiz starts.
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    // Set when we close a socket ourselves (unmount, or replacing a stale
    // one) so onclose knows not to treat it as a dropped connection.
    let deliberateClose = false;

    const wsHost = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/';

    // Exponential backoff with jitter: 1s, 2s, 4s, 8s, capped at 10s. The
    // jitter matters at 500 users - without it, a server restart makes every
    // client reconnect in the same instant and knock it over again.
    const MAX_RECONNECT_ATTEMPTS = 8;
    const reconnectDelay = () => {
      const base = Math.min(1000 * 2 ** reconnectAttempts, 10_000);
      return base + Math.random() * 500;
    };

    const scheduleReconnect = () => {
      if (!isMounted || deliberateClose) return;

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        setConnectionState('failed');
        return;
      }

      setConnectionState('reconnecting');
      const delay = reconnectDelay();
      reconnectAttempts++;
      reconnectTimer = setTimeout(initWebSocket, delay);
    };



    const initWebSocket = () => {
      if (!isMounted) return;

      socket = new WebSocket(wsHost);

      socket.onopen = () => {

        reconnectAttempts = 0;
        setConnectionState('connected');
        setSendFailed(false);

        if (!sessionId) {
          console.log("Session is not initiated. Try again...")
          return;
        }



        socket?.send(JSON.stringify({
          type: 'join',
          payload: {
            sessionId,
            role: isOrganizer ? 'ORGANIZER' : 'PARTICIPANT',
            participantId: isOrganizer ? undefined : participantId,
            userId: user?.id,
            // The server checks this login before it lets the socket run the
            // quiz, so a participant cannot claim the organizer role.
            token: isOrganizer ? token : undefined
          }
        }));

        // The host's list is a join-time snapshot plus per-arrival events, so
        // anyone who joined while this socket was still connecting is missing
        // from it, and a single dropped event is never made up. Reconcile on a
        // slow interval while the lobby is open; it is a cached read, and it
        // stops once the quiz starts.
        if (isOrganizer) {
          if (refreshTimer) clearInterval(refreshTimer);
          refreshTimer = setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'participants:refresh',
                payload: { sessionId },
              }));
            }
          }, 5000);
        }
      };


      socket.onmessage = (event) => {

        const { type, payload } = JSON.parse(event.data);

        switch (type) {
          case 'error':
            // The server refused a message, for example when this login is not
            // an organizer of the quiz.
            console.error('[ws]', payload?.code, payload?.message);
            break;
          case 'participants:sync':
            setParticipants(payload.participants);
            if (payload.joinCode) {
              setJoinCode(payload.joinCode);
            }
            setLiveVideo(Boolean(payload.liveVideo));
            break;
          case 'participant:joined':
            setParticipants(participant => [...participant, payload.participant].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
            break;
          case 'quiz:start':
            // Lobby is over; nobody new can appear, so stop reconciling.
            if (refreshTimer) {
              clearInterval(refreshTimer);
              refreshTimer = null;
            }
            setGameState(GameState.STARTING);
            setTimeout(() => {
              if (isOrganizer) socket?.send(JSON.stringify({ type: 'quiz:next-question', payload: { sessionId, questionIndex: 0 } }));
            }, 3000);
            break;
          case 'quiz:question':
            currentQuestionIdRef.current = payload.question?.id ?? null;
            setCurrentQuestion(payload.question);
            setSelectedAnswer(null);
            setCorrectAnswers([]);
            // Clear last question's tally rather than letting it show against
            // this one until the first answer arrives.
            setAnswerProgress(null);
            setRecentAnswerers([]);
            setGameState(GameState.QUESTION);
            setQuestionStartTime(Date.now());

            break;
          // Sent only to a reconnecting client, to put them back on the
          // question already in flight instead of a blank screen.
          case 'quiz:state-snapshot':
            currentQuestionIdRef.current = payload.question?.id ?? null;
            setCurrentQuestion(payload.question);
            setCorrectAnswers([]);
            setTimeLeft(payload.timeLeft);
            // Restoring their pick (or blocking a fresh one when the window
            // has closed) is what stops a rejoin scoring the same question
            // twice; the server rejects it either way.
            setSelectedAnswer(
              payload.alreadyAnswered ? (payload.selectedAnswerId ?? '__answered__') : null
            );
            // Scoring uses Date.now() - questionStartTime, so anchor it to
            // the real remaining time rather than the moment they rejoined.
            setQuestionStartTime(Date.now() - (payload.question.timeLimit - payload.timeLeft) * 1000);
            // Trust the server's index over local counting. qIndex is only
            // advanced by the host pressing Next, so a reload reset it to 0
            // while the quiz was on question 6: the counter read "Question 1"
            // and the next press sent the whole room back to question 2.
            if (typeof payload.questionIndex === 'number') {
              setQIndex(payload.questionIndex);
            }
            setGameState(payload.expired ? GameState.RESULTS : GameState.QUESTION);
            break;
          case 'quiz:timer-tick':
            // Floor at zero. A server that cannot close the question leaves
            // the countdown running, and a participant should see 0 rather
            // than watch it tick into negative numbers.
            setTimeLeft(Math.max(0, payload.timeLeft ?? 0));
            break;
          // Ignore a tally that arrives for a question already replaced: on a
          // slow connection the previous question's last answers can land
          // after the next question is on screen.
          case 'quiz:answer-progress':
            if (
              !currentQuestionIdRef.current ||
              currentQuestionIdRef.current === payload.questionId
            ) {
              // Never let the count go backwards. The zero-state sent when a
              // question opens can arrive after an early answer on a slow
              // connection, and would otherwise blank a tally already shown.
              setAnswerProgress((prev) =>
                prev && payload.answered < prev.answered
                  ? { answered: prev.answered, total: payload.total }
                  : { answered: payload.answered, total: payload.total }
              );

              if (payload.participantId) {
                setRecentAnswerers((prev) => {
                  // A duplicate submission must not pop a second avatar.
                  if (prev[0] === payload.participantId) return prev;
                  return [payload.participantId, ...prev.filter((id) => id !== payload.participantId)]
                    .slice(0, RECENT_AVATARS);
                });
              }
            }
            break;
          case 'quiz:question-results':
            setCorrectAnswers(payload.correctAnswers);
            setGameState(GameState.RESULTS);
            break;
          case 'quiz:leaderboard':
            setLeaderboard(payload.leaderboard);
            // The standings follow a question's results by two seconds, so
            // pressing on during that gap on the last question ends the quiz
            // first. Keep the late scores, they are the final ones, but stay
            // on the finished screen rather than reopening the leaderboard
            // with a "Next Question" button for a quiz that is over.
            setGameState((current) => current === GameState.ENDED ? current : GameState.LEADERBOARD);
            break;
          case 'quiz:ended':
            setGameState(GameState.ENDED);
            break;
        }
      };



      // onerror is always followed by onclose, so reconnect is scheduled
      // there rather than in both places.
      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (!isMounted || deliberateClose) return;
        scheduleReconnect();
      };

      setWs(socket);
    };



    const timeoutId = setTimeout(initWebSocket, 50);

    return () => {
      isMounted = false;
      deliberateClose = true;
      clearTimeout(timeoutId);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (refreshTimer) clearInterval(refreshTimer);
      if (socket) {
        // Drop the handler first: closing a socket fires onclose, which would
        // otherwise schedule a reconnect for a screen that is going away.
        socket.onclose = null;
        if (socket.readyState === 0) {
          socket.onopen = () => socket?.close();
        } else {
          socket.close();
        }
      }
    };

  }, [sessionId, isOrganizer]);


  // `ws?.send` on a closed socket does nothing and throws nothing, so every
  // send goes through here and reports whether the message actually left.
  const sendMessage = (message: { type: string; payload: Record<string, unknown> }) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setSendFailed(true);
      return false;
    }
    ws.send(JSON.stringify(message));
    setSendFailed(false);
    return true;
  };

  const handleStart = () => {
    sendMessage({ type: 'quiz:start', payload: { sessionId } });
  };

  const handleNext = () => {
    const nextIdx = qIndex + 1;
    const sent = sendMessage({
      type: 'quiz:next-question',
      payload: {
        sessionId,
        questionIndex: nextIdx
      }
    });
    if (sent) setQIndex(nextIdx);
  };


  const handleAnswer = (answerId: string) => {
    if (selectedAnswer || gameState !== GameState.QUESTION) return;

    const timeMs = Date.now() - questionStartTime;

    // Refuse the tap rather than queue it for the reconnect: a queued answer
    // could land after the question closed, with a timeMs that no longer
    // means anything.
    const sent = sendMessage({
      type: 'quiz:submit-answer',
      payload: {
        sessionId,
        participantId,
        questionId: currentQuestion.id,
        answerId,
        timeMs
      }
    });
    if (sent) setSelectedAnswer(answerId);
  }

  // Shown beside the answers and the host controls, so the reason they are
  // disabled or refused is where the user is looking, not only in the banner.
  const notSentNotice = (refused: string, waiting: string) => {
    if (!sendFailed && isConnected) return null;
    return (
      <p role="alert" className="mt-6 text-center text-sm sm:text-base text-red-400 font-secondary tracking-wide">
        {sendFailed ? `Not connected — ${refused}` : `Not connected — ${waiting}`}
      </p>
    );
  };


  // Rendered above every game state, so a participant always knows the live
  // connection dropped rather than silently missing questions.
  const ConnectionBanner = () => {
    if (connectionState === 'connected') return null;

    const failed = connectionState === 'failed';

    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed top-0 inset-x-0 z-100 px-4 py-2 text-center text-sm font-medium
          ${failed ? 'bg-red-600 text-white' : 'bg-amber-500 text-black'}`}
      >
        {failed ? (
          <span>
            Connection lost.{' '}
            <button
              onClick={() => window.location.reload()}
              className="underline font-semibold"
            >
              Reload to rejoin
            </button>
          </span>
        ) : (
          'Reconnecting…'
        )}
      </div>
    );
  };


  // Each game state is its own screen. They are built here rather than
  // returned directly so the live video below stays mounted across them:
  // returning it from every branch would reconnect it on each state change.
  const renderScreen = () => {
    if (gameState === GameState.WAITING) {

      return (
        <div className="min-h-screen w-full  bg-[#000000]/98 opacity-99">
          <ConnectionBanner />
          <div className="w-full   bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">

            <div className="min-h-screen flex flex-col items-center justify-center bg-surface relative overflow-hidden p-6">
              <BgBoss opacity="opacity-5" />





              <div className="z-10 text-center mb-8">

                {joinCode && (
                  <div className="mb-40 text-center border border-pink-700/30 shadow-md shadow-pink-600/50 py-3 rounded-2xl ">
                    <p className="text-lg sm:text-4xl font-semibold  font-secondary bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700 mb-3 tracking-wider">
                      Quiz-Access-Code
                    </p>
                    <h2 className="sm:text-6xl text-3xl font-special tracking-widest text-pink-500">
                      {joinCode}
                    </h2>
                  </div>
                )}

                {isOrganizer ? (
                  <>
                    <h1 className="text-3xl sm:text-5xl  uppercase  mb-5 font-secondary bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700 font-extrabold tracking-wider">Get Ready to Play!</h1>

                    <button
                      onClick={handleStart}
                      disabled={participants.length === 0 || !isConnected}
                      className="btn-primary py-4 px-12 rounded-lg text-xl bg-linear-to-t from-pink-600 to-pink-500 hover:from-pink-800/90 font-secondary transition duration-200  cursor-pointer  font-extrabold uppercase tracking-wider disabled:opacity-50"
                    >
                      Start Game
                    </button>
                    {notSentNotice('the game was not started.',
                      'the game can be started once the connection is back.')}
                  </>
                ) : (
                  <>
                    <div
                      key={user?.id || 'participant'}

                      className={`w-28 h-28 rounded-3xl bg-linnear-to-br bg-linear-to-t from-pink-800/40 to-transparent p-1 shadow-2xl mx-auto mb-6 `}
                    >
                      <img src={getAvatar(participantId || 'default')} alt="avatar" className="w-full h-full object-cover animate-[bounce_1.6s_infinite]" />
                    </div>
                    <h1 className="text-5xl font-bold mb-2 text-gray-300 font-secondary">You're in, <span className="bg-clip-text text-transparent bg-linear-to-t bg-pink-500 from-pink-700">  {username}! </span></h1>
                    <p className="text-zinc-300 tracking-wider text-lg flex items-center justify-center gap-4">Waiting for host to start <span className="animate-spin"> <FaSpinner className="text-pink-600 w-6 h-6" /> </span> </p>
                  </>
                )}
              </div>

              {isOrganizer && (
                <div className="z-10 w-full max-w-4xl">
                  <div className="flex items-center justify-between mb-4 border-b border-pink-600/30 pb-4">
                    <h3 className="font-bold flex items-center gap-2 font-secondary text-gray-300 tracking-wider text-xl"><LuUserSearch className="w-5 h-5 text-accent" /> Players ({participants.length})</h3>
                  </div>
                  <div className="flex flex-wrap gap-3">

                    {participants.map(p => (
                      <div

                        key={p.id}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className={`w-18 h-18 rounded-2xl bg-linear-to-br ${getAvatarColor(p.id)} p-1 shadow-lg border border-white/10 overflow-hidden`}>
                          <img src={getAvatar(p.id)} alt={p.username} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xl text-gray-400 font-light tracking-wider text-center max-w-20 font-secondary">{p.username}</span>
                      </div>
                    ))}
                    {participants.length === 0 && <span className="text-zinc-500 italic tracking-wide text-lg">Waiting for players to join...</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }


    if (gameState === GameState.STARTING) {
      return (
        <div className="bg-[#000000]/98 opacity-99 w-full min-h-screen">
          <ConnectionBanner />

          <div className="w-full   bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">


            <div className="min-h-screen  flex items-center justify-center bg-primary">
              <BgBoss opacity="opacity-5" />
              <h1

                className="text-8xl font-black bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700 italic tracking-wide shadow-black drop-shadow-2xl"
              >
                GET READY!
              </h1>
            </div>
          </div>
        </div>
      );
    }




    if (gameState === GameState.QUESTION || gameState === GameState.RESULTS) {


      return (

        <div className="w-full min-h-screen  bg-[#000000]/99 opacity-98">
          <ConnectionBanner />

          <div className="w-full min-h-screen z-50  bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">


            <div className="min-h-screen z-0 w-full relative text-gray flex flex-col items-center justify-center pt-16 px-4 sm:px-8 md:px-16 lg:px-32 xl:px-80 pb-16 mx-auto overflow-hidden">

              <BgBoss opacity="opacity-5" />


              <div className="absolute top-18">

                <Link to={"/"} className="text-4xl tracking-wider font-special bg-clip-text text-transparent bg-linear-to-b from-pink-400 to-pink-600"> Rexial </Link>
              </div>

              <div className="w-full max-w-5xl flex flex-col">




                <div className="flex justify-between items-center mb-6 px-4 sm:mb-8">
                  <div className="text-xl sm:text-3xl md:text-4xl text-pink-600 tracking-wider font-special">
                    Question: {qIndex + 1}
                  </div>

                  <div
                    className={`w-12 border-none px-8 sm:px-1 font-special tracking-wide  h-12 sm:w-14 sm:h-14 md:w-16 md:h-16  flex gap-2 items-center justify-center text-lg sm:text-2xl md:text-3xl  
          ${timeLeft <= 5
                        ? ' text-red-500 animate-pulse'
                        : 'border-none text-gray-200 '
                      }`}
                  >
                    <span className="font-secondary font-lg tracking-wide font-extrabold bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700">timeleft: </span> {timeLeft}
                  </div>
                </div>

                {/* Answers in, live. Lets the room see the question filling up,
                    and explains an early finish: the counter reaching the total
                    is why the question closed before the clock. */}
                {answerProgress && answerProgress.total > 0 && (() => {
                  const { answered, total } = answerProgress;
                  const allIn = answered >= total;
                  // Floor, and hold just short of full until everyone is in:
                  // rounding 199/200 up to 100% would show a full bar while the
                  // room is still waiting on someone.
                  const pct = allIn
                    ? 100
                    : Math.min(99, Math.floor((answered / total) * 100));

                  return (
                    <div
                      className="mx-4 sm:mx-6 mb-6 sm:mb-10"
                      role="status"
                      aria-live="polite"
                      aria-label={`${answered} of ${total} players answered`}
                    >
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="font-secondary tracking-wider text-sm sm:text-2xl md:text-3xl lg:text-4xl text-zinc-400">
                          {allIn ? 'Everyone has answered' : 'Answers in'}
                        </span>
                        <span className="font-special tracking-wider text-base sm:text-3xl md:text-4xl lg:text-5xl">
                          <span className={allIn ? 'text-emerald-400' : 'text-pink-400'}>{answered}</span>
                          <span className="text-zinc-500"> / {total}</span>
                        </span>
                      </div>

                      {/* Avatars of whoever answered most recently, riding the
                          head of the bar. Newest is leftmost and largest, so an
                          arrival is visible from across a room. */}
                      <div className="relative h-9 sm:h-20 md:h-24 mb-1 sm:mb-3">
                        <div
                          className="absolute bottom-0 flex items-end transition-[left] duration-500 ease-out"
                          style={{
                            // Held off both edges: at 0% the cluster would sit
                            // outside the bar on the left, at 100% it would
                            // overflow on the right.
                            left: `clamp(0px, ${pct}%, 100%)`,
                            transform: `translateX(${pct < 12 ? '0' : pct > 92 ? '-100%' : '-50%'})`,
                          }}
                        >
                          {recentAnswerers.map((id, i) => (
                            <div
                              key={id}
                              className={`animate-avatar-pop rounded-full bg-linear-to-br ${getAvatarColor(id)} p-[1.5px] shadow-lg ring-1 ring-black/30 shrink-0`}
                              style={{
                                // Newest in front, older ones tucked behind and
                                // fading, so the cluster reads as a trail.
                                width: i === 0 ? avatarLead : avatarTrail,
                                height: i === 0 ? avatarLead : avatarTrail,
                                marginLeft: i === 0 ? 0 : avatarOverlap,
                                opacity: Math.max(0.25, 1 - i * 0.12),
                                zIndex: RECENT_AVATARS - i,
                              }}
                            >
                              <img
                                src={getAvatar(id)}
                                alt=""
                                aria-hidden="true"
                                className="w-full h-full object-cover rounded-full"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="h-2 sm:h-5 md:h-7 lg:h-9 w-full rounded-full bg-zinc-700/40 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                            allIn
                              ? 'bg-linear-to-r from-emerald-500 to-emerald-400'
                              : 'bg-linear-to-r from-pink-600 to-pink-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {!allIn && (
                        <p className="text-right text-xs sm:text-lg md:text-xl lg:text-2xl text-zinc-500 font-secondary tracking-wide mt-1 sm:mt-3">
                          {total - answered} still answering
                        </p>
                      )}
                    </div>
                  );
                })()}

                <h2 className="text-2xl md:text-3xl lg:text-4xl bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-600/80 font-secondary tracking-wider font-bold text-center mt-6 sm:mt-10 mb-10 sm:mb-16 px-2 leading-snug">
                  {currentQuestion?.text}
                </h2>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-auto font-secondary tracking-wider">
                  {currentQuestion?.answers.map((answer: any) => {
                    const isSelected = selectedAnswer === answer.id;
                    const isCorrect = correctAnswers.includes(answer.id);
                    const showResults = gameState === GameState.RESULTS;

                    let bgClass =
                      "bg-zinc-800/20 text-gray-300 hover:bg-zinc-700/20 border border-gray-700/40 cursor-pointer";

                    let opacityClass =
                      showResults && !isCorrect ? "opacity-50" : "opacity-100";

                    if (showResults) {
                      if (isCorrect)
                        bgClass =
                          "bg-green-500/60 border-green-400 font-secondary text-gray-100";
                      else if (isSelected && !isCorrect)
                        bgClass =
                          "bg-red-500/20 font-secondary border-red-500/50 text-red-200";
                      else bgClass = "bg-gray-800/10 border-gray-700 text-zinc-300";
                    } else if (isSelected) {
                      bgClass =
                        "border border-pink-800/30 bg-pink-600/20 font-secondary text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]";
                    }

                    return (
                      <button
                        key={answer.id}
                        onClick={() => handleAnswer(answer.id)}
                        disabled={Boolean(selectedAnswer) || showResults || !isConnected}
                        className={`relative w-full px-4 sm:px-6 md:px-12 py-3 sm:py-4 rounded-full border-2 text-base sm:text-lg md:text-xl font-bold flex items-center justify-center text-center transition-all ${bgClass} ${opacityClass}`}
                      >
                        {answer.text}

                        {showResults && isCorrect && (
                          <BiCheckCircle className="absolute right-4 w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
                        )}

                        {showResults && isSelected && !isCorrect && (
                          <BiXCircle className="absolute right-4 w-5 h-5 sm:w-6 sm:h-6 opacity-80" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {gameState === GameState.QUESTION && !isOrganizer && !selectedAnswer &&
                  notSentNotice('your answer was not sent.',
                    'answers cannot be sent until the connection is back.')}

              </div>
            </div>
          </div>





          {gameState === GameState.RESULTS && isOrganizer && (
            <div className="fixed bottom-0 left-0 w-full p-6 bg-background/80 backdrop-blur-md border-t border-white/10 flex flex-col items-end">
              <button onClick={handleNext} disabled={!isConnected} className="btn-primary py-3 px-8 text-lg font-bold disabled:opacity-50">Show Standings →</button>
              {notSentNotice('the next step was not sent.', 'wait for the connection to come back.')}
            </div>
          )}
        </div>
      );
    }

    if (gameState === GameState.LEADERBOARD) {
      return (

        <div className=" bg-[#000000]/98 opacity-99 min-h-screen">
          <ConnectionBanner />

          <div className="w-full min-h-screen z-50  bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">




            <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6 sm:px-6 bg-surface relative overflow-hidden">
              <BgBoss opacity="opacity-5" />



              <h1 className="sm:text-4xl text-2xl mb-4 sm:mb-6 z-10 bg-clip-text text-transparent  bg-linear-to-b from-pink-600 to-pink-800/90 font-special tracking-wider flex items-center gap-3">
                <MdViewInAr className="w-8 h-8  text-pink-700 font-special" /> Leaderboard
              </h1>

              {/* Shown on a projector between questions, so the whole top ten
                  has to be visible at once: no scrolling, rows sized to fit the
                  viewport rather than a fixed height that overflows. */}
              <div className="flex items-start justify-center w-full">


                <div className="w-full max-w-2xl space-y-1 sm:space-y-1.5 z-10">

                  {sortedLeaderboard.slice(0, ROUND_LIMIT).map((player, idx) => (
                    <div
                      key={player.id}


                      // Ring marks the viewer's own row: without it, finding
                      // yourself in the list takes longer than the results
                      // screen stays up.
                      className={`flex items-center justify-between px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl border ${player.id === participantId ? 'ring-2 ring-pink-400/70 ' : ''}${idx === 0 ? 'bg-yellow-500/20 border-yellow-500/50 shadow-lg' : idx === 1 ? 'bg-gray-300/30 border-gray-500/80 shadow-lg' : idx === 2 ? 'bg-amber-600/20 border-amber-500/50 shadow-lg' : 'bg-zinc-600/10 border-white/10'}`}>
                      <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                        <span className={`font-black text-lg sm:text-2xl w-7 sm:w-8 shrink-0 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-amber-700' : 'text-zinc-500'}`}>#{idx + 1}</span>
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-linear-to-br ${getAvatarColor(player.id)} p-0.5 shadow overflow-hidden`}>
                          <img src={getAvatar(player.id)} alt={player.username} className="w-full h-full object-cover " />
                        </div>
                        {/* truncate: a long name must not push the score off the row */}
                        <span className="font-extrabold sm:text-lg text-sm text-gray-300 font-secondary tracking-wider truncate">{player.username}</span>
                      </div>
                      <span className="sm:text-3xl text-xl font-special text-pink-500 tracking-wider shrink-0 ml-3">{player.score}</span>
                    </div>
                  ))}

                  {/* Same pinned row between questions: a participant well down
                      the board should still be able to follow their own
                      progress, not just watch the leaders. */}
                  {showMyRoundRank && (
                    <>
                      <p className="text-center text-zinc-500 text-xs sm:text-sm font-secondary tracking-wider py-0.5">
                        + {roundHiddenCount} more {roundHiddenCount === 1 ? 'player' : 'players'}
                      </p>

                      <div className="flex items-center justify-between px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl border-2 border-pink-500/60 bg-pink-600/15">
                        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                          <span className="font-black text-lg sm:text-2xl w-7 sm:w-8 shrink-0 text-pink-400">#{myRank}</span>
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-linear-to-br ${getAvatarColor(me!.id)} p-0.5 shadow overflow-hidden`}>
                            <img src={getAvatar(me!.id)} alt={me!.username} className="w-full h-full object-cover " />
                          </div>
                          <span className="font-extrabold sm:text-lg text-sm text-pink-400 font-secondary tracking-wider truncate">You</span>
                        </div>
                        <span className="sm:text-3xl text-xl font-special text-pink-400 tracking-wider shrink-0 ml-3">{me!.score}</span>
                      </div>
                    </>
                  )}

                  {!showMyRoundRank && roundHiddenCount > 0 && (
                    <p className="text-center text-zinc-500 text-xs sm:text-sm font-secondary tracking-wider py-0.5">
                      + {roundHiddenCount} more {roundHiddenCount === 1 ? 'player' : 'players'}
                    </p>
                  )}

                </div>

              </div>

              {isOrganizer && (
                <div className="fixed bottom-0 sm:right-6 z-50  p-6 bg-black  border-t border-white/20 flex flex-col items-center">
                  <button onClick={handleNext} disabled={!isConnected} className="disabled:opacity-50 cursor-pointer active:scale-95  py-4 px-12 text-lg uppercase tracking-widest shadow-xl font-secondary bg-linear-to-b from-pink-500 to-pink-700/70 hover:to-pink-700/60 transition duration-200 text-gray-900 font-extrabold border border-pink-800 rounded-2xl">Next Question</button>
                  {notSentNotice('the next question was not sent.', 'wait for the connection to come back.')}
                </div>
              )}
            </div>

          </div>
        </div>
      );
    }




    if (gameState === GameState.ENDED) {
      return (

        <div className="w-full min-h-screen  bg-[#000000]/98 opacity-99">
          <ConnectionBanner />

          <div className="w-full min-h-screen z-50  bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">




            <div className="min-h-screen  flex flex-col items-center justify-center p-6  overflow-hidden">
              <BgBoss opacity="opacity-5" />

              <div>
                <h1 className="sm:text-5xl text-center text-[26px] bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700 uppercase tracking-widest mb-2 font-special">Quiz Finished!</h1>
                <p className="text-lg sm:text-3xl text-center text-gray-300 font-bold mb-6 sm:mb-10  font-secondary tracking-wide"> Congratulations Winners ! </p>
              </div>

              <div className="w-full max-w-4xl mx-auto space-y-6">

                {/* Top three, as a podium: winner centred and raised, runners-up
                    either side. `items-end` is what makes the bases line up so
                    the height difference reads as a podium rather than as
                    misalignment. */}
                <div className="flex flex-col sm:flex-row justify-center items-center sm:items-end gap-4 sm:gap-6 mb-8">
                  {podium.map(({ rank, player, order }) => {
                    const isFirst = rank === 1;
                    const isMe = player.id === participantId;

                    const medal =
                      rank === 1 ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                        : rank === 2 ? 'bg-[#C0C0C0]/25 border-gray-400/60 text-[#D8D8D8]'
                          : 'bg-[#4A3004]/50 border-amber-500/50 text-amber-500';

                    return (
                      <div
                        key={player.id}
                        className={`${order} flex flex-col gap-2 items-center rounded-2xl border-2 ${medal}
                          w-full max-w-[18rem] sm:w-44 ${isFirst ? 'sm:w-52 sm:pb-10' : ''}
                          px-4 py-5 ${isMe ? 'ring-2 ring-pink-400/70' : ''}`}
                      >
                        {isFirst && <span className="text-3xl leading-none">👑</span>}

                        <span className="text-2xl sm:text-3xl font-black font-secondary">
                          Rank: <span className="font-special font-light">{rank}</span>
                        </span>

                        <div className={`${isFirst ? 'w-20 h-20' : 'w-16 h-16'} rounded-xl bg-linear-to-br ${getAvatarColor(player.id)} p-0.5 shadow overflow-hidden`}>
                          <img
                            src={getAvatar(player.id)}
                            alt={player.username}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <span className="text-lg sm:text-xl font-bold mt-1 text-center font-secondary tracking-wide break-all">
                          {player.username}
                        </span>

                        <span className="text-xl sm:text-2xl font-special tracking-wide">
                          {player.score} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Rest of the performers till top-30 */}
                <div className="space-y-5">
                  {others.map((player, idx) => (
                    <div
                      key={player.id}
                      className={`flex justify-between items-center px-4 sm:py-5 py-3 rounded-2xl bg-surface border bg-zinc-600/30 ${player.id === participantId ? 'border-pink-400/70 ring-2 ring-pink-400/50' : 'border-white/10'}`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className="text-lg sm:text-2xl font-black text-gray-400 tracking-tighter">
                          #{idx + 4}
                        </span>

                        <div className={`sm:w-12 sm:h-12 h-10 w-10 rounded-xl bg-linear-to-br ${getAvatarColor(player.id)} p-0.5 shadow overflow-hidden`}>
                          <img
                            src={getAvatar(player.id)}
                            alt={player.username}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <span className="text-md sm:text-xl font-secondary font-extrabold tracking-wider text-pink-500/80">
                          {player.username}
                        </span>
                      </div>

                      <span className="text-md sm:text-2xl font-special tracking-wider text-pink-600">
                        {player.score} pts
                      </span>
                    </div>
                  ))}

                  {/* Placed outside the visible list: show them their own
                      standing rather than ending the quiz on other people's
                      names. */}
                  {showMyRank && (
                    <>
                      {hiddenCount > 0 && (
                        <p className="text-center text-zinc-500 text-sm sm:text-base font-secondary tracking-wider py-2">
                          + {hiddenCount} more {hiddenCount === 1 ? 'player' : 'players'}
                        </p>
                      )}

                      <div className="flex justify-between items-center px-4 sm:py-5 py-3 rounded-2xl border-2 border-pink-500/60 bg-pink-600/15">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <span className="text-lg sm:text-2xl font-black text-pink-400 tracking-tighter">
                            #{myRank}
                          </span>

                          <div className={`sm:w-12 sm:h-12 h-10 w-10 rounded-xl bg-linear-to-br ${getAvatarColor(me!.id)} p-0.5 shadow overflow-hidden`}>
                            <img
                              src={getAvatar(me!.id)}
                              alt={me!.username}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <span className="text-md sm:text-xl font-secondary font-extrabold tracking-wider text-pink-400">
                            You
                          </span>
                        </div>

                        <span className="text-md sm:text-2xl font-special tracking-wider text-pink-400">
                          {me!.score} pts
                        </span>
                      </div>
                    </>
                  )}

                  {/* Nothing pinned below, so say the list was cut. */}
                  {!showMyRank && hiddenCount > 0 && (
                    <p className="text-center text-zinc-500 text-sm sm:text-base font-secondary tracking-wider py-2">
                      + {hiddenCount} more {hiddenCount === 1 ? 'player' : 'players'}
                    </p>
                  )}
                </div>

              </div>

              <Link
                to={isOrganizer ? "/dashboard" : "/join"}
                state={isOrganizer ? undefined : { username }}
                className="mt-16 px-8 py-3 text-black font-bold font-secondary tracking-wide rounded-full bg-linear-to-b from-pink-500 to-pink-800/40 hover:to-pink-800/30 transition duration-200 shadow-sm active:shadow-none active:scale-95 shadow-pink-700"
              >
                {isOrganizer ? "Back to Dashboard" : "Join Another Quiz"}
              </Link>
            </div>
          </div>

        </div>
      );
    }



    return null;
  };


  // The host signs in; a player proves who they are with the token /join
  // handed out.
  const stageToken = isOrganizer
    ? token
    : (sessionId ? localStorage.getItem(participantTokenKey(sessionId)) : null);

  return (
    <>
      {/* First, so on narrow screens its space is held above the quiz. It
          stays on the final screen too, for the host to talk about the
          results; it goes when the host ends the call or leaves. */}
      {streamingEnabled && liveVideo && sessionId && (
        <Suspense fallback={null}>
          <LiveStage
            sessionId={sessionId}
            isOrganizer={isOrganizer}
            authToken={stageToken}
            quizEnded={gameState === GameState.ENDED}
          />
        </Suspense>
      )}
      {renderScreen()}
    </>
  );










}

export default LiveQuiz