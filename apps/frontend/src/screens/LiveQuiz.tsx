import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useEffect, useState } from "react";
import { LuUserSearch } from "react-icons/lu";
import { getAvatar, getAvatarColor } from "../utils/Avatars";
import { BiCheckCircle, BiTrophy, BiXCircle } from "react-icons/bi";
import BgBoss from "../components/BgBoss";
import { FaSpinner } from "react-icons/fa6";
import { MdViewInAr } from "react-icons/md";



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

  const { user } = useAuthStore();

  const participantId = location.state?.participantId;
  const username = location.state?.username;

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState>('WAITING');
  const [participants, setParticipants] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);



  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [qIndex, setQIndex] = useState(0);


  const topThree = leaderboard.slice(0, 3);

  const three = [topThree[1], topThree[0], topThree[2]];

  const others = leaderboard.slice(3);


  // if participant is missing, kick them out
  useEffect(() => {
    if (!isOrganizer && !participantId) {
      navigate('/join');
      return;
    }


    let socket: WebSocket | null = null;
    let isMounted = true;


    const wsHost = 'ws://localhost:8080/';



    const initWebSocket = () => {
      if (!isMounted) return;

      socket = new WebSocket(wsHost);

      socket.onopen = () => {

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
            userId: user?.id
          }
        }));

        console.log("JOin sent...")
      };


      socket.onmessage = (event) => {

        console.log("WS MESSAGE:", event.data);

        const { type, payload } = JSON.parse(event.data);

        switch (type) {
          case 'participants:sync':
            setParticipants(payload.participants);
            break;
          case 'participant:joined':
            setParticipants(participant => [...participant, payload.participant].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
            break;
          case 'quiz:start':
            setGameState(GameState.STARTING);
            setTimeout(() => {
              if (isOrganizer) socket?.send(JSON.stringify({ type: 'quiz:next-question', payload: { sessionId, questionIndex: 0 } }));
            }, 3000);
            break;
          case 'quiz:question':
            setCurrentQuestion(payload.question);
            setSelectedAnswer(null);
            setCorrectAnswers([]);
            setGameState(GameState.QUESTION);
            setQuestionStartTime(Date.now());
            break;
          case 'quiz:timer-tick':
            setTimeLeft(payload.timeLeft);
            break;
          case 'quiz:question-results':
            setCorrectAnswers(payload.correctAnswers);
            setGameState(GameState.RESULTS);
            break;
          case 'quiz:leaderboard':
            setLeaderboard(payload.leaderboard);
            setGameState(GameState.LEADERBOARD);
            break;
          case 'quiz:ended':
            setGameState(GameState.ENDED);
            break;
        }
      };

      setWs(socket);
    };



    const timeoutId = setTimeout(initWebSocket, 50);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (socket) {
        if (socket.readyState === 0) {
          socket.onopen = () => socket?.close();
        } else {
          socket.close();
        }
      }
    };

  }, [sessionId, isOrganizer]);


  const handleStart = () => {
    ws?.send(JSON.stringify({ type: 'quiz:start', payload: { sessionId } }));
  };

  const handleNext = () => {
    const nextIdx = qIndex + 1;
    setQIndex(nextIdx);
    ws?.send(JSON.stringify({
      type: 'quiz:next-question',
      payload: {
        sessionId,
        questionIndex: nextIdx
      }
    }))
  };


  const handleAnswer = (answerId: string) => {
    if (selectedAnswer || gameState !== GameState.QUESTION) return;

    setSelectedAnswer(answerId);
    const timeMs = Date.now() - questionStartTime;

    ws?.send(JSON.stringify({
      type: 'quiz:submit-answer',
      payload: {
        sessionId,
        participantId,
        questionId: currentQuestion.id,
        answerId,
        timeMs
      }
    }))
  }



  if (gameState === GameState.WAITING) {

    return (
      <div className="min-h-screen flex flex-col items-center bg-[#000000]/98 opacity-99 justify-center bg-surface relative overflow-hidden p-6">
        <BgBoss opacity="opacity-5" />
        <div className="z-10 text-center mb-12">
          {isOrganizer ? (
            <>
              <h1 className="text-3xl sm:text-5xl  uppercase  mb-5 font-secondary bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700 font-extrabold tracking-wider">Get Ready to Play!</h1>

              <button
                onClick={handleStart}
                disabled={participants.length === 0}
                className="btn-primary py-4 px-12 rounded-lg text-xl bg-linear-to-t from-pink-600 to-pink-500 hover:from-pink-800/90 font-secondary transition duration-200  cursor-pointer  font-extrabold uppercase tracking-wider disabled:opacity-50"
              >
                Start Game
              </button>
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
    );
  }


  if (gameState === GameState.STARTING) {
    return (
      <div className="min-h-screen bg-[#000000]/98 opacity-99 flex items-center justify-center bg-primary">
        <BgBoss opacity="opacity-5" />
        <h1

          className="text-8xl font-black bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700 italic tracking-wide shadow-black drop-shadow-2xl"
        >
          GET READY!
        </h1>
      </div>
    );
  }




  if (gameState === GameState.QUESTION || gameState === GameState.RESULTS) {


    return (
      <div className="min-h-screen  bg-[#000000]/98 opacity-99 text-gray flex flex-col pt-8 px-6 pb-24  mx-auto">

        <BgBoss opacity="opacity-5" />
        <div className="flex justify-between items-center mb-12">
          <div className="font-bold text-xl text-zinc-200">Question {qIndex + 1}</div>
          <div className={`w-16 h-16 rounded-full  flex items-center justify-center text-3xl font-black border-4 ${timeLeft <= 5 ? 'border-red-500 text-red-500 animate-pulse' : 'border border-gray-100 text-gray-50'}`}>
            {timeLeft}
          </div>
        </div>

        <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 px-4 leading-tight">{currentQuestion?.text}</h2>

        <div className="grid sm:grid-cols-2 gap-4 md:gap-6 mt-auto">
          {currentQuestion?.answers.map((answer: any, i: number) => {
            const isSelected = selectedAnswer === answer.id;
            const isCorrect = correctAnswers.includes(answer.id);
            const showResults = gameState === GameState.RESULTS;

            let bgClass = "bg-surface hover:bg-white/5 border-border";
            let opacityClass = showResults && !isCorrect ? "opacity-50" : "opacity-100";

            if (showResults) {
              if (isCorrect) bgClass = "bg-green-500 border-green-400 text-white ";
              else if (isSelected && !isCorrect) bgClass = "bg-red-500/20 border-red-500/50 text-red-200";
              else bgClass = "bg-surface border-border";
            } else if (isSelected) {
              bgClass = "bg-primary border-primary text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]";
            }

            return (
              <button

                onClick={() => handleAnswer(answer.id)}
                disabled={Boolean(selectedAnswer) || showResults}
                className={`min-h-30 p-6 rounded-2xl border-2 text-xl font-bold flex items-center justify-center text-center transition-all ${bgClass} ${opacityClass}`}
              >
                {answer.text}
                {showResults && isCorrect && <BiCheckCircle className="absolute right-4 w-6 h-6 opacity-80" />}
                {showResults && isSelected && !isCorrect && <BiXCircle className="absolute right-4 w-6 h-6 opacity-80" />}
              </button>
            );
          })}
        </div>

        {gameState === GameState.RESULTS && isOrganizer && (
          <div className="fixed bottom-0 left-0 w-full p-6 bg-background/80 backdrop-blur-md border-t border-white/10 flex justify-end">
            <button onClick={handleNext} className="btn-primary py-3 px-8 text-lg font-bold">Show Standings →</button>
          </div>
        )}
      </div>
    );
  }

  if (gameState === GameState.LEADERBOARD) {
    return (
      <div className="min-h-screen  bg-[#000000]/98 opacity-99 flex flex-col items-center justify-center p-6 bg-surface relative overflow-hidden">
        <BgBoss opacity="opacity-5" />



        <h1 className="sm:text-5xl text-3xl mb-12 z-10 bg-clip-text text-transparent  bg-linear-to-b from-pink-600 to-pink-800/90 font-special tracking-wider flex items-center gap-3">
          <MdViewInAr className="w-10 h-10  text-pink-700 font-special" /> Leaderboard
        </h1>

        <div className="flex items-center py-2 justify-center h-1/2 w-full overflow-y-auto ">


          <div className="w-full max-w-2xl  space-y-3 z-10">

            {leaderboard.slice(0, 30).map((player, idx) => (
              <div
                key={player.id}


                className={`flex items-center h-16 sm:h-17 justify-between px-5 rounded-xl border ${idx === 0 ? 'bg-yellow-500/20 border-yellow-500/50  transform scale-100 sm:scale-105 shadow-xl' : idx === 1 ? 'bg-gray-300/30 border-gray-500/80 transform scale-100 sm:scale-103 shadow-xl' : idx === 2 ? 'bg-amber-600/20 border-amber-500/50 transform scale-100 sm:scale-101 shadow-xl' : 'bg-zinc-600/10 border-white/10'}`}>
                <div className="flex items-center gap-6">
                  <span className={`font-black text-2xl w-8 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-amber-700' : 'text-zinc-500'}`}>#{idx + 1}</span>
                  <div className={`sm:w-12 sm:h-12 w-9 h-9 rounded-xl bg-linear-to-br ${getAvatarColor(player.id)} p-0.5 shadow overflow-hidden`}>
                    <img src={getAvatar(player.id)} alt={player.username} className="w-full h-full object-cover " />
                  </div>
                  <span className="font-extrabold   sm:text-xl text-md text-gray-300 font-secondary tracking-wider">{player.username}</span>
                </div>
                <span className="  sm:text-4xl text-2xl font-special text-pink-500 tracking-wider ">{player.score}</span>
              </div>
            ))}

          </div>

        </div>

        {isOrganizer && (
          <div className="fixed bottom-0 sm:right-6 z-50  p-6 bg-black  border-t border-white/20 flex justify-center">
            <button onClick={handleNext} className="cursor-pointer active:scale-95  py-4 px-12 text-lg uppercase tracking-widest shadow-xl font-secondary bg-linear-to-b from-pink-500 to-pink-700/70 hover:to-pink-700/60 transition duration-200 text-gray-900 font-extrabold border border-pink-800 rounded-2xl">Next Question</button>
          </div>
        )}
      </div>
    );
  }




  if (gameState === GameState.ENDED) {
    return (
      <div className="min-h-screen  bg-[#000000]/98 opacity-99 flex flex-col items-center justify-center p-6  overflow-hidden">
        <BgBoss opacity="opacity-5" />

        <div>
          <h1 className="sm:text-5xl text-center text-[26px] bg-clip-text text-transparent bg-linear-to-b from-pink-500 to-pink-700 uppercase tracking-widest mb-2 font-special">Quiz Finished!</h1>
          <p className="text-lg sm:text-3xl text-center text-gray-300 font-bold mb-6 sm:mb-10  font-secondary tracking-wide"> Congratulations Winners ! </p>
        </div>

        <div className="w-full max-w-4xl mx-auto space-y-6">

          {/* top three performers */}
          <div className="   sm:flex  justify-center items-center gap-3  sm:gap-12">
            {three.map((player, idx) => {
              const isFirst = idx === 1;
              const rank = isFirst ? 1 : idx === 0 ? 2 : 3;

              return (
                <div
                  key={player.id}
                  className={`flex flex-col gap-2  mb-8 items-center p-5 rounded-2xl w-40
        ${isFirst
                      ? 'bg-yellow-500/20 w-60 border border-yellow-500/30 text-yellow-500 scale-110'
                      : 'bg-surface border border-white/5'}
        ${rank === 2 ? 'mt-6 w-55 bg-[#C0C0C0]/40 text-[#C0C0C0] border-2 border-gray-400' : ''}
        ${rank === 3 ? 'mt-10 w-55 bg-[#4A3004]/50 text-amber-600 border-2 border-amber-400' : ''}
        `}
                >
                  <span className="text-3xl font-black font-secondary"> Rank: <span className="font-special font-light"> {rank}  </span> </span>

                  <div className={`w-16 h-16 rounded-xl bg-linear-to-br ${getAvatarColor(player.id)} p-0.5 shadow overflow-hidden`}>
                    <img
                      src={getAvatar(player.id)}
                      alt={player.username}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <span className="text-xl font-bold mt-2 text-center font-secondary tracking-wide">
                    {player.username}
                  </span>

                  <span className=" text-2xl font-special tracking-wide">
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
                className="flex justify-between items-center px-4 sm:py-5 py-3 rounded-2xl bg-surface border border-white/10 bg-zinc-600/30"
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
          </div>

        </div>

        <Link to={isOrganizer ? "/dashboard" : "/"} className="mt-16 px-8 py-3 text-black font-bold font-secondary tracking-wide rounded-full bg-linear-to-b from-pink-500 to-pink-800/40 hover:to-pink-800/30 transition duration-200 shadow-sm active:shadow-none active:scale-95 shadow-pink-700">
          {isOrganizer ? "Back to Dashboard" : "Play Again"}
        </Link>
      </div>
    );
  }


  return null;










}

export default LiveQuiz