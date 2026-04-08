import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useEffect, useState } from "react";
import { LuUserSearch } from "react-icons/lu";



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


function LiveQuiz({isOrganizer = false}: LiveQuizProps) {

  const {sessionId} = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {user} = useAuthStore();

  const participantId = location.state.participantId;
  const username = location.state.username;

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

   
   // if participant is missing, kick them out
  useEffect(() => {
    if(!isOrganizer && !participantId){
      navigate('/join');
      return;
    }
 

  let socket:WebSocket | null = null;
  let isMounted = true;


  const wsHost = (import.meta as any).env.VITE_WS_URL ||
                 (window.location.hostname === 'localhost'
                  ? 'ws://localhost:8080'
                  : `ws//${window.location.hostname}:8080`
                 );

   const initWebSocket = () => {
    if(!isMounted) return;

    socket = new WebSocket(wsHost);

    socket.onopen = () => {
      socket?.send(JSON.stringify({
        type: 'join',
        payload: {
          sessionId,
          role: isOrganizer ? 'ORGANIZER': 'PARTICIPANT',
          participantId: isOrganizer ? undefined : participantId,
          userId: user?.id
        }
      }));
    };

      
       socket.onmessage = (event) => {
        const { type, payload } = JSON.parse(event.data);
        
        switch (type) {
          case 'participants:sync':
            setParticipants(payload.participants);
            break;
          case 'participant:joined':
            setParticipants(participant => [...participant, payload.participant].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
            break;
          case 'quiz:started':
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
      ws?.send(JSON.stringify({type: 'quiz:start', payload: {sessionId}}));
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
      if(selectedAnswer || gameState !== GameState.QUESTION) return;

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



    if(gameState === GameState.WAITING) {

   return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface relative overflow-hidden p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 z-0" />
        
        <div className="z-10 text-center mb-12">
          {isOrganizer ? (
            <>
              <h1 className="text-4xl font-black uppercase tracking-tight mb-2 text-white">Get Ready to Play!</h1>
              <p className="text-zinc-400 mb-8 max-w-md mx-auto">Tell players to go to <span className="font-mono text-white bg-white/10 px-2 py-1 rounded">localhost:5173/join</span></p>
              <button 
                onClick={handleStart} 
                disabled={participants.length === 0}
                className="btn-primary py-4 px-12 text-xl shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.5)] transition-all font-bold uppercase tracking-widest disabled:opacity-50"
              >
                Start Game
              </button>
            </>
          ) : (
            <>
              <div
                key={user?.id || 'participant'}
                
                className={`w-24 h-24 rounded-3xl bg-linnear-to-br ${getAvatarColor(participantId || 'default')} p-1 shadow-2xl mx-auto mb-6 overflow-hidden`}
              >
                <img src={getAvatar(participantId || 'default')} alt="avatar" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl font-bold mb-2">You're in, {username}!</h1>
              <p className="text-zinc-400">Waiting for host to start...</p>
            </>
          )}
        </div>

        {isOrganizer && (
          <div className="z-10 w-full max-w-4xl">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
              <h3 className="font-bold flex items-center gap-2"><LuUserSearch className="w-5 h-5 text-accent"/> Players ({participants.length})</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              
                  {participants.map(p => (
                  <div 
                  
                    key={p.id}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${getAvatarColor(p.id)} p-1 shadow-lg border border-white/10 overflow-hidden`}>
                      <img src={getAvatar(p.id)} alt={p.username} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-xs font-bold text-center max-w-20 truncate">{p.username}</span>
                  </div>
                ))}
              {participants.length === 0 && <span className="text-zinc-500 italic">Waiting for players to join...</span>}
            </div>
          </div>
        )}
      </div>
    );




    }
  




          


    


}

export default LiveQuiz