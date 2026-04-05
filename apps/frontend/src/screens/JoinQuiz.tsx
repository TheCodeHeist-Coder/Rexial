import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';


import { api } from '../services/api';
import { BsArrowLeft } from 'react-icons/bs';
import { RiLoader2Fill } from 'react-icons/ri';
import BgBoss from '../components/BgBoss';




function JoinQuiz() {
    const location = useLocation();
    const navigate = useNavigate();

    const [code, setCode] = useState(location.state?.code || '');
    const [username, setUsername] = useState(location.state?.username || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || !username) return;

        setError('');
        setLoading(true);

        try {
            const { data } = await api.post('/session/join', { code, username });
            // Redirect to play arena with session/participant data
            navigate(`/quiz/play/${data.sessionId}`, {
                state: { participantId: data.participantId, username, quizTitle: data.quizTitle }
            });
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to join quiz');
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen w-full  bg-[#000000]/98 opacity-99 flex items-center justify-center relative overflow-hidden px-4">
            <BgBoss opacity='opacity-5' />


            <Link to="/" className="absolute text-center top-6 left-6  flex items-center gap-2 font-bold text-xl tracking-tighter hover:opacity-80 transition-opacity">
                <BsArrowLeft className="w-7 h-7 font-extrabold text-zinc-300" />
            </Link>


            <div className="glass-card w-full max-w-sm p-8 relative z-10 border border-pink-700/60 bg-zinc-700/30 rounded-2xl px-4 py-8">


                <h1 className="text-3xl font-extrabold tracking-wider text-center mb-10 bg-clip-text text-transparent bg-linear-to-b from-pink-400 to-pink-700 font-secondary">Join the live quiz</h1>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleJoin} className=" space-y-8 flex flex-col items-center justify-center">
                    <div>
                        <label className="block text-md font-bold uppercase tracking-wider text-zinc-400 font-main  mb-1 ml-1">Game PIN</label>
                        <input
                            type="text"
                            value={code}
                            onChange={e => setCode(e.target.value.toUpperCase())}
                            className="input-field border-2 border-pink-500/60 py-2 px-4 rounded-xl text-center text outline-none text-xl tracking-widest font-mono uppercase font-bold text-white placeholder:text-zinc-600"
                            placeholder="e.g. XY3F12"
                            maxLength={6}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-md font-bold uppercase tracking-wider text-zinc-400 font-main mb-1 ml-1">Nickname</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="input-field border-2 border-pink-500/60 py-2 px-7 outline-none rounded-xl text-gray-300 font-semibold text-lg text-center"
                            placeholder="Enter your name"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-linear-to-r from-pink-600 to-pink-800  hover:to-pink-600 hover:from-pink-800  font-secondary font-extrabold text-black  cursor-pointer active:scale-95 text-xl py-4 rounded-xl flex items-center justify-center gap-2 mt-4 transition duration-150"
                    >
                        {loading ? <RiLoader2Fill className="w-6 h-6 animate-spin" /> : 'Enter Game'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default JoinQuiz;