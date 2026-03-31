import { useState } from "react"
import BgBoss from "../components/BgBoss"
import { LuLoaderPinwheel } from "react-icons/lu"
import { BsArrowRight } from "react-icons/bs"

import { Link, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import { api } from "../services/api"

function Login() {



    const [email, setEmail] = useState<string>('')
    const [password, setPassword] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false);

    const [error, setError] = useState<string>('');

    const navigate = useNavigate();

    const setAuth = useAuthStore((state) => state.setAuth);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true)

        try {
            const { data } = await api.post('/auth/login', { email, password });
            setAuth(data.user, data.token);
            navigate('/dashboard');
        } catch (error: any) {

            setError(error.response?.data?.error || "Failed to login...")

        } finally {
            setLoading(false);
        }

    }




    return (
        <div className="min-h-screen w-full  bg-[#000000]/98 opacity-99 ">
            <BgBoss opacity="opacity-8" />


            <div className="w-full min-h-screen flex flex-col items-center justify-center ">


                <div className="flex flex-col gap-3 mb-8">
                    <p className=" uppercase tracking-wider font-secondary text-pink-600 text-lg font-bold mb-2 pl-2 text-center"> Welcome back </p>



                    <h1 className=" text-6xl font-secondary font-extrabold text-gray-100 text-center tracking-wide"> Midnight <span className="text-pink-400 drop-shadow-md drop-shadow-pink-950"> Pulse </span> </h1>



                    <p className="content font-main  text-sm font-medium text-gray-400 tracking-wider max-w-110 mt-2 text-center">Sign in to continue your journey into the kinetic archive.</p>
                </div>




                <div className="border mt-5 border-gray-800 shadow-md shadow-rose-600 py-10 bg-[#20201F]/60 px-12 w-2/8 rounded-4xl">

                    <div className="withGoogle text-center text-gray-50 border border-gray-500 rounded-full py-3 px-2 mt-2 mb-5"> Login With Google </div>


                    <div className="partition flex items-center justify-center gap-3 my-4 ">
                        <div className="border-b border-gray-700 w-full">  </div>
                        <p className="text-gray-500 font-medium tracking-wide"> OR </p>
                        <div className="border-b border-gray-700 w-full">  </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5 mt-8">
                        <div className="flex flex-col gap-2">
                            <label className="block text-lg font-light text-zinc-400 mb-1 ml-1 font-main tracking-wider">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="input-field bg-black w-full text-gray-400 font-normal py-3 px-8 rounded-full  outline-none bg-none"
                                placeholder="iamraj@google.com"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="block text-lg font-light text-zinc-400 mb-1 ml-1 font-main tracking-wider">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="input-field bg-black w-full text-gray-400 font-normal py-3 px-8 rounded-full  outline-none"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-linear-to-l from-pink-500 to-pink-700 text-xl font-semibold font-secondary tracking-wide cursor-pointer active:scale-95 transition duration-100 rounded-full btn-primary py-3 flex items-center justify-center gap-2 mt-12"
                        >
                            {loading ? <LuLoaderPinwheel
                                className="w-5 h-5 animate-spin" /> : (
                                <>Login <BsArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>


                    <div className="bottom">
                        <p className="text-center text-gray-500 mt-6 font-main tracking-wide"> Don't have an account? <Link to={"/signup"} className="text-pink-500 font-secondary font-bold cursor-pointer "> Sign up </Link> </p>
                    </div>


                </div>
            </div>



        </div>
    )
}

export default Login