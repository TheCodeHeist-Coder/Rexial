import React, { useState } from "react"
import BgBoss from "../components/BgBoss"
import Steps from "../smallUnits.tsx/Steps"
import { LuLoaderPinwheel } from "react-icons/lu"
import { BsArrowRight } from "react-icons/bs"
import { Link, useNavigate } from "react-router-dom"
import { api } from "../services/api"
import { useAuthStore } from "../store/authStore"



function Signup() {

    const [name, setName] = useState<string>('')
    const [email, setEmail] = useState<string>('')
    const [password, setPassword] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false);

    const [error, setError] = useState<string>('');

    const navigate = useNavigate();
    const setAuth = useAuthStore((state) => state.setAuth);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('');
        setLoading(true);

        try {

            const { data } = await api.post('/auth/register', { name, email, password });
            setAuth(data.user, data.token);
            navigate('/dashboard');


        } catch (error: any) {
            setError(error.response?.data?.erorr || "Failed to register...")

        } finally {
            setLoading(true);
        }



    }


    return (
        <div className="w-full min-h-screen  bg-[#000000]/98 opacity-99">
            <BgBoss opacity="opacity-10" />

            <div className="content  w-full min-h-screen flex items-center justify-center px-40">

                {/* left content design */}
                <div className="left flex-1 text-gray-50 justify-center items-center  flex flex-col">

                    <div className="text-content">
                        <p className=" uppercase tracking-wider font-secondary text-pink-600 text-lg font-bold mb-2 pl-2"> Join the kinetic archive </p>



                        <h1 className=" text-8xl font-secondary font-extrabold text-gray-300 tracking-wide"> Midnight <span className="text-pink-400 drop-shadow-md drop-shadow-pink-950"> Pulse </span> </h1>



                        <p className="content font-main  text-lg font-medium text-gray-400 tracking-wider max-w-110 mt-8"> Join the arena of knowledge. Join <span> Qtrive </span> and transform the way you learn through interactive archives </p>
                    </div>


                    <div className="info-card flex w-full px-16 text-3xl mt-8 justify-between gap-5">

                        <Steps number={0o1} title="Real-time" description="Instant feedback on every query" />
                        <Steps number={0o2} title="Arena Rank" description="Climb the global archives" />


                    </div>


                </div>



                {/* Right main signup Page */}
                <div className="right  flex-1 flex justify-center items-center">

                    <div className="border  border-gray-800 shadow-md shadow-rose-600 py-10 bg-[#20201F]/60 px-10 w-2/3 rounded-4xl">

                        <div className="heading flex flex-col gap-2 items-center justify-center mb-10 ">
                            <h1 className="font-main text-4xl font-bold tracking-wide text-gray-200"> Create Account </h1>
                            <p className="text-gray-400 font-normal tracking-wider"> Start your journey with us </p>
                        </div>


                        <div className="withGoogle text-center text-gray-50 border border-gray-500 rounded-full py-3 px-2 mt-6 mb-5"> Signup With Google </div>


                        <div className="partition flex items-center justify-center gap-3 my-4 ">
                            <div className="border-b border-gray-700 w-full">  </div>
                            <p className="text-gray-500 font-medium tracking-wide"> OR </p>
                            <div className="border-b border-gray-700 w-full">  </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm text-center"> {error} </div>
                        )}



                        <form onSubmit={handleSubmit} className="space-y-5 mt-8">
                            <div className="flex flex-col gap-2">
                                <label className="block text-lg font-light text-zinc-400 mb-1 ml-1 font-main tracking-wider ">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="input-field bg-black w-full text-gray-400 font-normal py-3 px-8 rounded-full outline-none"
                                    placeholder="Enter Your Name"
                                    required
                                />
                            </div>
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
                                    <>Create account <BsArrowRight className="w-4 h-4" /></>
                                )}
                            </button>
                        </form>


                        <div className="bottom">
                            <p className="text-center text-gray-500 mt-6 font-main tracking-wide"> Already have an account? <Link to={"/login"} className="text-pink-500 font-secondary font-bold cursor-pointer"> Sign in </Link> </p>
                        </div>


                    </div>

                </div>

            </div>


        </div>
    )
}

export default Signup