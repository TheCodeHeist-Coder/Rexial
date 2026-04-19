import { Link, useParams } from "react-router-dom"
import { useAuthStore } from "../store/authStore";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import {  BiCheckCircle, BiLoader, BiXCircle } from "react-icons/bi";
import BgBoss from "../components/BgBoss";



function InviteAccept() {

  const { token } = useParams();


  const { user } = useAuthStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [msg, setMsg] = useState('');


  useEffect(() => {

    if (!user) {
      setStatus('error');
      setMsg('You must be logged in to accept an invitation. Please login or register with the invited email');
      return;
    }

    const acceptInvite = async () => {
      try {
        await api.post(`/invite/accept/${token}`);
        setStatus('success');
      } catch (error: any) {
        setStatus('error');
        setMsg(error.response?.data?.error || 'Failed to accept invitation');

      }
    };

    acceptInvite();

  }, [token, user]);


  return (
    <div className="min-h-screen w-full bg-[#000000]/98 opacity-99 flex items-center justify-center p-4">
      <BgBoss opacity="opacity-5" />

      <div className="w-full flex items-center justify-center min-h-screen bg-linear-to-tl from-transparent via-pink-600/10 to-transparent">




        <div className="glass-card  w-full p-8 text-center flex flex-col items-center">


          {status === 'loading' && (
            <>
              <BiLoader className="w-8 h-8 text-white animate-spin mb-4" />
              <h2 className="text-xl font-bold">Verifying invitation...</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <BiCheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h2 className="text-2xl tracking-wider mb-2 bg-clip-text text-transparent bg-linear-to-t from-pink-500 to-pink-400 font-special">Invitation Accepted Successfully!</h2>
              <p className="text-zinc-400 mb-8 font-secondary font-extrabold tracking-wider text-xl">You are now a co-organizer for this quiz.</p>
              <Link to="/dashboard" className="max-w-96 py-3 px-8 w-full  font-secondary font-extrabold tracking-wide rounded-full 
            bg-linear-to-b from-pink-500 to-pink-700/10 
            hover:to-pink-700/20 transition duration-200 active:scale-95">Go to Dashboard</Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex flex-col items-center justify-center text-center px-4 sm:px-6 md:px-8 py-8 w-full max-w-2xl mx-auto">

                <BiXCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mb-4" />

                <h2 className="text-xl sm:text-3xl md:text-5xl tracking-wide sm:tracking-widest mb-3 
      bg-clip-text text-transparent bg-linear-to-t from-pink-500 to-pink-400 font-special">
                  Couldn't Accept Invite
                </h2>

                <p className="text-red-400/80 font-extrabold text-sm sm:text-base md:text-lg 
      tracking-wide sm:tracking-widest font-secondary mb-6 sm:mb-8">
                  {msg}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 w-full sm:w-auto justify-center items-center">

                  {!user && (
                    <>
                      <Link
                        to="/login"
                        className="w-full sm:w-auto text-center btn-primary py-3 px-6 sm:px-10 
            font-secondary font-extrabold tracking-wide rounded-full 
            bg-linear-to-b from-pink-500 to-pink-700/10 
            hover:to-pink-700/20 transition duration-200 active:scale-95"
                      >
                        Sign In
                      </Link>

                      <Link
                        to="/signup"
                        className="w-full sm:w-auto text-center btn-outline py-3 px-6 sm:px-8 
            font-secondary font-extrabold tracking-wide rounded-full 
            bg-linear-to-b from-pink-500 to-pink-700/10 
            hover:to-pink-700/20 transition duration-200 active:scale-95"
                      >
                        Register new account
                      </Link>
                    </>
                  )}

                  {user && (
                    <Link
                      to="/dashboard"
                      className="w-full sm:w-auto text-center btn-outline py-3 px-6 font-secondary font-extrabold tracking-wide rounded-full 
            bg-linear-to-b from-pink-500 to-pink-700/10 
            hover:to-pink-700/20 transition duration-200 active:scale-95"
                    >
                      Back to Dashboard
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default InviteAccept