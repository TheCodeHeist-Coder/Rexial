import { Link, useNavigate, useParams } from "react-router-dom"
import BgBoss from "../components/BgBoss"
import { BsArrowLeft, BsMailbox, BsTrash2 } from "react-icons/bs"
import { api } from "../services/api"
import { useEffect, useState } from "react"
import { BiPlay, BiPlus, BiSave } from "react-icons/bi"
import { LuUserSearch } from "react-icons/lu"


function QuizBuilder() {

  const { id } = useParams();


  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false)
  const [hosting, setHosting] = useState(false);


  const [showAddQ, setShowAddQ] = useState(false);
  const [qText, setQText] = useState('');
  const [qTime, setQTime] = useState('15');
  const [answers, setAnswers] = useState([{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');




  useEffect(() => {
    if (id) {
      fetchQuiz();
    }
  }, [id]);


  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/quizzes/${id}`);


      setQuiz(data);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    try {
      setLoading(true);
      const { data } = await api.post(`/quizzes/${id}/generate-access-code`);
      setQuiz({ ...quiz, joinCode: data.joinCode, status: 'ACTIVE' })
     

    } catch (error) {
      console.log(error);

    } finally {
      setLoading(false);
    }
  }


  const handleHostLive = async () => {
    if (hosting) return alert("Quiz is already Hosted!")
    setHosting(true);
    try {
      const { data } = await api.post(`/quizzes/${id}/start-session`);
      console.log("Api data is", data);
      navigate(`/quiz/manage/${data.sessonId}`);



    } catch (error) {
      alert('Failed to start session');
      console.log(error);
      setHosting(false);
    }
  }



  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      await api.post(`/quizzes/${id}/invite`, { email: inviteEmail });

      console.log("Email is:", inviteEmail)
     
      setInviteMsg('Invite sent successfully!');
      setInviteEmail('');
      setTimeout(() => setInviteMsg(''), 3000);
    } catch (err) {
      setInviteMsg('Failed to invite.');
    }
  };

  const handleSaveQuestion = async () => {
    if (!qText.trim() || answers.some(a => !a.text.trim())) return alert('Fill all text fields');
    if (!answers.some(a => a.isCorrect)) return alert('Select at least one correct answer');

    try {
      await api.post(`/quizzes/${id}/questions`, {
        text: qText,
        timeLimit: parseInt(qTime) || 15,
        answers
      });
      setShowAddQ(false);
      setQText('');
      setQTime('15');
      setAnswers([{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]);
      fetchQuiz();
    } catch (err) {
      console.error(err);
    }
  };


  return (
    <div className="min-h-screen w-full bg-[#000000]/98 opacity-99">
      <BgBoss opacity="opacity-5" />

        <div className="w-full min-h-screen bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">

      

      {/* Navbar */}
      <header className="border-b border-border bg-black/90 max-w-7xl m-auto rounded-b-full  sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-zinc-300 font-extrabold  py-1 px-6 rounded-full hover:text-white transition-colors">
              <BsArrowLeft className="w-7 h-7 " />
            </Link>
            <h1 className="font-bold text-lg text-gray-50 truncate max-w-50 md:max-w-xs">{quiz?.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${quiz?.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
              {quiz?.status}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {quiz?.joinCode ? (
              <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
                <span className=" text-primary font-extrabold text-gray-300 font-secondary text-2xl">CODE:</span>
                <span className=" font-bold  font-special tracking-[1px] text-2xl bg-clip-text text-transparent bg-linear-to-b from-pink-400 to-pink-700">{quiz.joinCode}</span>
              </div>
            ) : (
              <button onClick={handleGenerateCode} className=" cursor-pointer bg-green-700/30 hover:bg-green-700/40 shadow-sm shadow-green-800 font-secondary tracking-wider text-green-500 font-extrabold flex items-center gap-2 py-2 px-6 rounded-md border border-green-600/40 text-sm">
                {loading ? "Generating..." : "Generate Join Code"}
              </button>
            )}
            {quiz?.status === 'ACTIVE' && (
              <button
                onClick={handleHostLive}
                disabled={hosting || (quiz.questions?.length === 0)}
                className="text-gray-50 bg-green-500/30 hover:bg-green-500/40 cursor-pointer active:scale-95 px-6 rounded-md font-secondary font-extrabold tracking-widest border border-green-600/40 flex items-center gap-2 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={quiz.questions?.length === 0 ? 'Add at least one question first' : 'Host a live quiz session'}
              >
                <BiPlay className="w-4 h-4 fill-current" />
                {hosting ? 'Starting...' : 'Host Live'}
              </button>
            )}
          </div>
        </div>
      </header>



      <main className="max-w-7xl mx-auto px-6 pt-12 pb-32 grid md:grid-cols-[1fr_300px] gap-12">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold font-secondary text-gray-300 tracking-wider">Questions ({quiz?.questions?.length || 0})</h2>
            <button onClick={() => setShowAddQ(!showAddQ)} className="flex items-center gap-2 py-2.5 px-4 rounded-full bg-pink-600/30 hover:bg-pink-600/40 active:scale-90 border border-pink-700 cursor-pointer text-pink-500 font-secondary tracking-wider font-extrabold transition duration-100">
              <BiPlus className="w-4 h-4" /> Add Question
            </button>
          </div>

          {showAddQ && (
            <div className="glass-card py-8 px-12 mt-12 bg-zinc-900/40 border border-gray-800/50 rounded-2xl">
              <div className="flex justify-between gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Add Question Here..."
                  className="input-field py-4 px-6 mb-4 font-secondary outline-none border border-pink-800/60 rounded-xl text-gray-200 font-medium text-xl flex-1"
                  value={qText} onChange={e => setQText(e.target.value)} />
                <div className="w-24 flex flex-col items-center justify-center">
                  <input type="text"
                    placeholder="Secs"
                    className="input-field  text-center bg-green-800/20 outline-none border border-green-800 max-w-18 py-2.5 text-gray-50 font-extrabold   rounded-xl flex items-center justify-center"
                    value={qTime}
                    onChange={e => setQTime(e.target.value)} />
                  <span className="text-xs text-green-500 tracking-widest font-bold block text-center mt-1">Seconds</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 mt-6">
                {answers.map((ans, idx) => (
                  <div key={idx} className={`flex items-center border rounded-lg overflow-hidden transition-colors ${ans.isCorrect ? 'border-green-500/50 bg-green-500/5' : 'border border-amber-800/40 bg-surface'}`}>
                    <button
                      onClick={() => setAnswers(answers.map((a, i) => i === idx ? { ...a, isCorrect: true } : { ...a, isCorrect: false }))}
                      className={`w-12 h-full flex items-center justify-center cursor-pointer ${ans.isCorrect ? 'bg-green-500 text-gray-200 font-extrabold text-xl ' : 'bg-surface hover:bg-white/5 bg-gray-800/30 text-zinc-500'}`}
                    >
                      {ans.isCorrect ? '✓' : ''}
                    </button>
                    <input
                      type="text"
                      placeholder={`Answer ${idx + 1}`}
                      className="w-full bg-transparent px-3 py-3 font-secondary text-gray-200 focus:outline-none"
                      value={ans.text}
                      onChange={e => setAnswers(answers.map((a, i) => i === idx ? { ...a, text: e.target.value } : a))}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-10 flex justify-end gap-5">
                <button onClick={() => setShowAddQ(false)} className="px-6 py-2 text-zinc-400 hover:text-zinc-300 bg-rose-800/10 hover:bg-rose-800/20 rounded-xl border active:scale-95 border-rose-600/40 cursor-pointer">Cancel</button>
                <button onClick={handleSaveQuestion} className="btn-primary flex items-center gap-2 bg-green-600/10 hover:bg-green-600/20 border border-green-600/30 active:scale-95 text-gray-300 cursor-pointer px-4 rounded-xl py-2"><BiSave className="w-4 h-4" /> Save Question</button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {quiz?.questions?.map((q: any, idx: number) => (
              <div key={q.id} className="bg-surface  border bg-zinc-900/40 border-border rounded-xl py-6 px-10 border-gray-700/30 transition-colors group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className=" text-lg font-secondary text-gray-300 tracking-wider font-semibold">
                    <span className="text-pink-500 mr-2 font-special">{idx + 1}.</span> {q.text}</h3>
                  <div className="flex items-center gap-3">
                    <span className="bg-green-600/10  border border-white/10 px-4 py-1 font-semibold tracking-wide rounded text-xs text-zinc-400">{q.timeLimit}s</span>
                    <button className="text-red-400 font-semibold font-main tracking-wider rounded-md border border-rose-700/20 cursor-pointer bg-rose-600/20 hover:bg-rose-600/30 active:scale-95 hover:text-red-400 transition-colors py-1 px-4 flex items-center gap-1"><BsTrash2 className="w-4 h-4" />Delete</button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-6">
                  {q.answers.map((a: any) => (
                    <div key={a.id} className={`px-3 py-4 font-secondary font-semibold tracking-wider  rounded text-sm border ${a.isCorrect ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-white/5 border-gray-800/60 text-zinc-400'}`}>
                      {a.text}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {quiz?.questions?.length === 0 && !showAddQ && (
              <div className="text-center py-12 border border-dashed border-border rounded-xl text-zinc-500">
                No questions added yet.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 ">
          <div className=" p-5 bg-zinc-900/40 rounded-2xl border border-gray-700/40">
            <h3 className="font-bold font-secondary  flex items-center gap-2 mb-4 text-sm uppercase tracking-wider text-zinc-400">
              <LuUserSearch className="w-5 h-5" /> Co-Organizers
            </h3>
            <div className="space-y-3 mb-6">
              {quiz?.organizers?.map((org: any) => (
                <div key={org.id} className="flex justify-between items-center text-sm">
                  <span className="truncate pr-2 text-gray-50">{org.user?.name || org.inviteEmail}</span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded">{org.inviteStatus}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleInvite} className="space-y-3 pt-4 border-t border-white/20">
              <label className="text-xs text-zinc-400 block ml-1 font-secondary tracking-wider">Invite Collaborator</label>
              <div className="flex gap-4 items-center">
                <input
                  type="email"
                  placeholder="Email"
                  className="input-field border border-pink-800/50 rounded-xl text-gray-300 font-bold font-secondary outline-none tracking-wider py-3 text-sm px-3 flex-1"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}

                />
                <button type="submit" className="outline-none border border-green-500/50 bg-green-600/20 hover:bg-green-600/30 active:scale-95 font-secondary text-white px-3 py-1.5 rounded-lg flex cursor-pointer items-center gap-2"><BsMailbox className="w-4 h-4" /> Send </button>
              </div>
              {inviteMsg && <p className="text-xs text-green-400">{inviteMsg}</p>}
            </form>
          </div>
        </div>
      </main>

  </div>
    </div>
  )
}

export default QuizBuilder