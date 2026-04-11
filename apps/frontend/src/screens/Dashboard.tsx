import { FaArrowRightToBracket } from "react-icons/fa6"
import BgBoss from "../components/BgBoss"
import { Link, useNavigate } from 'react-router-dom'
import React, { useEffect, useState } from "react"
import { useAuthStore } from "../store/authStore"
import { api } from "../services/api"
import { BiPlay, BiPlus } from "react-icons/bi"
import { BsClock, BsRainbow } from "react-icons/bs"

function Dashboard() {

  const [quizzes, setQuizzes] = useState<{ organizedQuizes: any[], participated: any[] }>({ organizedQuizes: [], participated: [] })

  const [showCreate, setShowCreate] = useState<boolean>(false);

  const [newTitle, setNewTitle] = useState<string>('');

  const [newDescription, setNewDescription] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);

  const [titleLoading, setTitleLoading] = useState<boolean>(false);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();





  useEffect(() => {
    fetchQuizzes();
  }, []);

 


  const fetchQuizzes = async () => {
    try {
      const { data } = await api.get('/quizzes');
      setQuizzes(data);
    } catch (error) {
      console.log(error)
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setTitleLoading(true)

    try {
      const { data } = await api.post('/quizzes', { title: newTitle, description: newDescription });
    
      setNewTitle('');
      setShowCreate(false);
      navigate(`/quiz/${data.id}/edit`);
    } catch (error) {
      console.log('Failed to create quiz', error)
    } finally {
      setTitleLoading(false);
    }
  };






  return (
   
   
    <div className="w-full min-h-screen  bg-[#000000]/98 opacity-99 pb-12">
      <BgBoss opacity="opacity-5" />

      <div className="w-full bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">

      

      {/* Simple navbar */}
      <div className="sticky top-0 pt-3 z-50 px-2">
        <div className="nav max-w-7xl bg-black/95 rounded-full m-auto py-3 px-6 sm:px-6  flex items-center justify-between">

          {/* Logo */}
          <div className="logo-home">
            <Link
              to={"/"}
              className="logo font-special text-xl sm:text-2xl md:text-4xl font-bold tracking-wide bg-clip-text text-transparent bg-linear-to-t from-pink-900 to-pink-500"
            >
              Qtrive
            </Link>
          </div>

          {/* User + Logout */}
          <div className="logout-name flex items-center gap-2 sm:gap-4">

            <p className="font-secondary text-gray-300 text-xs sm:text-lg truncate max-w-25 sm:max-w-none">
              Hii,
              <span className="pl-1 text-pink-600 font-bold text-lg">
                {user?.name}
              </span>
            </p>

            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="font-secondary font-semibold border border-rose-600 cursor-pointer active:scale-95 transition duration-100 hover:text-rose-400 py-1.5 px-5 sm:px-5 rounded-lg text-rose-600 flex items-center gap-1 sm:gap-2 bg-rose-700/10 hover:bg-rose-700/20 text-xs sm:text-base"
            >
              <span className="hidden sm:inline">Logout</span>
              <FaArrowRightToBracket />
            </button>

          </div>
        </div>
      </div>

      {/* quiz create starting */}
      <div className="flex max-w-7xl px-12 m-auto flex-col md:flex-row items-start md:items-center justify-between gap-4 mt-12 mb-12">
        <div>
          <h1 className="text-4xl font-secondary tracking-wide text-[#cdcdcd] font-bold mb-2">My Dashboard</h1>
          <p className="text-zinc-400 font-main font-normal tracking-wider">Manage your hosted quizzes and view your history.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className=" flex items-center gap-2 py-2.5 px-4 rounded-full bg-pink-600/30 hover:bg-pink-600/40 active:scale-90 border border-pink-700 cursor-pointer text-pink-500 font-secondary tracking-wider font-extrabold transition duration-100"
        >
          <BiPlus /> Create New Quiz
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Create New Quiz</h2>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                placeholder="Quiz title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-2 bg-black/50 border border-white/10 rounded-lg mb-4 text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-pink-600 hover:bg-pink-700 rounded-lg font-semibold text-white transition"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg font-semibold text-white transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hosted Quizzes */}
      <div className="max-w-7xl px-12 mt-20 m-auto mb-16 ">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 font-secondary text-pink-600">
          <BiPlay className="w-5 h-5 text-primary text-pink-600" /> Hosted Quizzes
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-surface animate-pulse" />)}
          </div>
        ) : quizzes?.organizedQuizes?.length === 0 ? (
          <div className="text-center py-16 bg-black/50 border border-white/10 rounded-2xl">
            <p className=" bg-clip-text font-main tracking-wide text-md text-transparent bg-linear-to-t from-pink-700 to-pink-400 mb-4">You haven't created any quizzes yet.</p>
            <button onClick={() => setShowCreate(true)} className="border active:scale-95  border-pink-900 py-2 cursor-pointer px-5 rounded-full text-pink-500 bg-pink-900/30 font-secondary">Create one now</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 bg-black/60 gap-6 py-8 px-5 border border-white/10 rounded-2xl">
            {quizzes.organizedQuizes.map((q: any) => (
              <Link to={`/quiz/${q.id}/edit`} key={q.id}>
                <div

                  className="bg-zinc-700/20 hover:bg-zinc-700/30 border-dashed border border-gray-400/30 backdrop-blur-2xl rounded-xl p-6 h-full flex flex-col justify-between group hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-xs px-2 py-1 rounded border font-medium ${q.status === 'ACTIVE' ? 'bg-green-800/10 text-green-400 border-green-500/20 px-4 py-1.5' : 'bg-yellow-800/30 px-4 py-1.5 text-yellow-400 border-yellow-500/20'}`}>
                        {q.status}
                      </span>
                      <span className="text-xs text-zinc-500 font-semibold tracking-wider">{new Date(q.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-lg tracking-wider font-secondary font-bold mb-2 group-hover:text-primary text-gray-300 transition-colors line-clamp-2">{q.title}</h3>
                    <p className="text-md tracking-wider font-secondary font-light  mb-2 group-hover:text-primary text-gray-400 transition-colors line-clamp-2">{q.description}</p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-400">
                    <div className="flex items-center gap-2 text-pink-600 font-semibold tracking-wide"><BsRainbow className="w-5 h-5" /> {q._count?.questions || 0} Qs</div>
                    <div className="flex items-center gap-1 text-green-600 font-semibold tracking-wide"><BiPlay className="w-5 h-5" /> {q._count?.sessions || 0} Sessions</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>



      {/* Participated quizzes */}
      <div className="max-w-7xl m-auto px-12 mt-24">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 font-secondary text-pink-600">
          <BsClock className="w-5 h-5 text-accent text-pink-600" /> Play History
        </h2>

        {loading ? (
          <div className="h-24 bg-black text-gray-50 rounded-xl bg-surface animate-pulse" />
        ) : quizzes.participated.length === 0 ? (
          <div className="text-center py-28 bg-black/50 border border-white/10 rounded-2xl">
            <p className=" bg-clip-text font-main tracking-wide text-md text-transparent bg-linear-to-t from-pink-700 to-pink-400 mb-4">No played history yet.</p>
          </div>
        ) : (
          <div className=" rounded-xl border border-white/5 bg-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface border-b border-white/10 text-sm font-medium text-zinc-400">
                  <th className="p-4">Quiz Title</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">My Score</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.participated.map((session: any) => {
                  const myData = session.participants[0];
                  return (
                    <tr key={session.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4 font-medium">{session.quiz.title}</td>
                      <td className="p-4 text-zinc-400 text-sm">{new Date(session.startedAt || session.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-primary font-bold">{myData?.score || 0} pts</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>




      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center  p-4  bg-black/60">
          <div

            className="bg-black/98 border border-pink-950/20 shadow shadow-pink-800 rounded-2xl w-full max-w-xl py-8 flex flex-col gap-5 items-center"
          >
            <h3 className="text-2xl font-bold mb-4 font-secondary text-pink-500 tracking-wide">Create New Quiz</h3>
            <form className="flex flex-col" onSubmit={handleCreate}>
              <input
                type="text"
                autoFocus
                placeholder="Enter quiz title..."
                className="input-field mb-6 py-3 px-5 font-bold tracking-wider font-secondary outline-none border border-pink-800 w-96 rounded-xl text-gray-300"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
              <textarea
                placeholder="Description (optional)"
                className="input-field mb-6 resize-none h-24 text-gray-300 font-bold font-secondary tracking-wider border border-pink-900 outline-none py-2 px-4 rounded-xl"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="border active:scale-95 bg-rose-800/20 hover:bg-rose-800/30 tracking-wider font-secondary w-full cursor-pointer px-10 py-3 rounded-xl font-extrabold text-rose-600 border-rose-500/40">Cancel</button>
                <button type="submit" disabled={!newTitle.trim()} className="border active:scale-95 font-secondary w-full cursor-pointer border-pink-600/40 px-10 py-3 bg-pink-600/20 hover:bg-pink-600/30 rounded-xl font-extrabold text-pink-600"> {titleLoading ? "Creating..." : "Create"}  </button>
              </div>
            </form>
          </div>
        </div>
      )}









    </div>
 


    </div>
  )
}

export default Dashboard