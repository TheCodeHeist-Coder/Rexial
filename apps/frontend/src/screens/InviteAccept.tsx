import { Link, useNavigate, useParams } from "react-router-dom"
import { useAuthStore } from "../store/authStore";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { BiBrain, BiCheckCircle, BiLoader, BiXCircle } from "react-icons/bi";



function InviteAccept() {

    const { token } = useParams();

    const navigate = useNavigate();

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
       <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full p-8 text-center flex flex-col items-center">
        <BiBrain className="w-12 h-12 text-primary mb-6" />
        
        {status === 'loading' && (
          <>
            <BiLoader className="w-8 h-8 text-white animate-spin mb-4" />
            <h2 className="text-xl font-bold">Verifying invitation...</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <BiCheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invitation Accepted!</h2>
            <p className="text-zinc-400 mb-8">You are now a co-organizer for this quiz.</p>
            <Link to="/dashboard" className="btn-primary py-3 px-8 w-full block">Go to Dashboard</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <BiXCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-white">Couldn't Accept Invite</h2>
            <p className="text-red-400/80 mb-8">{msg}</p>
            
            <div className="flex flex-col gap-3 w-full">
              {!user && (
                <>
                  <Link to="/login" className="btn-primary py-3">Sign In</Link>
                  <Link to="/register" className="btn-outline py-3">Register new account</Link>
                </>
              )}
              {user && (
                <Link to="/dashboard" className="btn-outline py-3">Back to Dashboard</Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    )
}

export default InviteAccept