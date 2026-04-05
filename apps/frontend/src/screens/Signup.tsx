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
       <div className="w-full min-h-screen bg-[#000000]/98 opacity-99">
  <BgBoss opacity="opacity-10" />

  <div className="content w-full min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-44">

    {/* LEFT (Hidden on mobile) */}
    <div className="hidden lg:flex flex-1 text-gray-50 justify-center items-center flex-col">

      <div className="text-content text-center lg:text-left">
        <p className="uppercase tracking-wider font-secondary text-pink-600 text-sm sm:text-lg font-bold mb-2">
          Join the kinetic archive
        </p>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-secondary font-extrabold text-gray-300 tracking-wide">
          Midnight <span className="text-pink-400 drop-shadow-md drop-shadow-pink-950">Pulse</span>
        </h1>

        <p className="font-main text-sm sm:text-base lg:text-lg text-gray-400 tracking-wide max-w-md mt-6">
          Join the arena of knowledge. Join <span>Qtrive</span> and transform the way you learn through interactive archives.
        </p>
      </div>

      {/* Cards */}
      <div className="info-card flex  w-full max-w-2xl px-4 mt-8 justify-between items-center gap-4">
        <Steps number={1} title="Real-time" description="Instant feedback on every query" />
        <Steps number={2} title="Arena Rank" description="Climb the global archives" />
      </div>

    </div>

    {/* RIGHT (Signup - always visible) */}
    <div className="right w-full lg:flex-1 flex justify-center items-center">

      <div className="border border-gray-800 shadow-md shadow-rose-600 py-6 sm:py-10 bg-[#20201F]/60 px-4 sm:px-8 w-full max-w-md lg:max-w-lg rounded-2xl sm:rounded-3xl">

        {/* Heading */}
        <div className="heading flex flex-col gap-2 items-center mb-6 sm:mb-10">
          <h1 className="font-main text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide text-gray-200">
            Create Account
          </h1>
          <p className="text-gray-400 text-sm sm:text-base tracking-wide">
            Start your journey with us
          </p>
        </div>

        {/* Google */}
        <div className="text-center text-gray-50 border border-gray-500 rounded-full py-2 sm:py-3 px-2 mb-4 sm:mb-5 text-sm sm:text-base">
          Signup With Google
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 my-4">
          <div className="border-b border-gray-700 w-full"></div>
          <p className="text-gray-500 text-xs sm:text-sm">OR</p>
          <div className="border-b border-gray-700 w-full"></div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 sm:p-3 rounded-lg mb-4 text-xs sm:text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 mt-6">

          {/* Name */}
          <div>
            <label className="block text-sm sm:text-base text-zinc-400 mb-1 font-main tracking-wide">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-black w-full text-gray-400 py-2 sm:py-3 px-4 sm:px-6 rounded-full outline-none text-sm sm:text-base"
              placeholder="Enter Your Name"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm sm:text-base text-zinc-400 mb-1 font-main tracking-wide">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-black w-full text-gray-400 py-2 sm:py-3 px-4 sm:px-6 rounded-full outline-none text-sm sm:text-base"
              placeholder="iamraj@google.com"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm sm:text-base text-zinc-400 mb-1 font-main tracking-wide">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-black w-full text-gray-400 py-2 sm:py-3 px-4 sm:px-6 rounded-full outline-none text-sm sm:text-base"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-linear-to-l from-pink-500 to-pink-700 text-sm sm:text-lg font-semibold font-secondary tracking-wide cursor-pointer active:scale-95 transition rounded-full py-2 sm:py-3 flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <LuLoaderPinwheel className="w-4 h-4 animate-spin" />
            ) : (
              <>Create account <BsArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        {/* Bottom */}
        <p className="text-center text-gray-500 mt-4 sm:mt-6 text-xs sm:text-sm font-main tracking-wide">
          Already have an account?
          <Link to={"/login"} className="text-pink-500 font-secondary font-bold ml-1">
            Sign in
          </Link>
        </p>

      </div>

    </div>

  </div>
</div>
    )
}

export default Signup