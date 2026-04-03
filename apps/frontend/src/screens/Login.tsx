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
        <div className="min-h-screen w-full bg-[#000000]/98 opacity-99">
  <BgBoss opacity="opacity-10" />

  <div className="w-full min-h-screen flex flex-col items-center justify-center px-4 sm:px-6">

    {/* Heading */}
    <div className="flex flex-col gap-2 sm:gap-3 mb-6 sm:mb-8 text-center">

      <p className="uppercase tracking-wider font-secondary text-pink-600 text-md sm:text-xl font-bold">
        Welcome back
      </p>

      <h1 className="text-4xl sm:text-5xl md:text-7xl font-secondary font-extrabold text-gray-100 tracking-wide">
        Midnight <span className="text-pink-400 drop-shadow-md drop-shadow-pink-950">Pulse</span>
      </h1>

      <p className="font-main text-md sm:text-sm md:text-lg text-gray-400 tracking-wide max-w-md mx-auto">
        Sign in to continue your journey into the kinetic archive.
      </p>

    </div>

    {/* Card */}
    <div className="border border-gray-800 shadow-md shadow-rose-600 py-6 sm:py-10 bg-[#20201F]/60 px-4 sm:px-8 w-full max-w-md rounded-2xl sm:rounded-3xl">

      {/* Google */}
      <div className="text-center text-gray-50 border border-gray-500 rounded-full py-2 sm:py-3 px-2 mb-4 sm:mb-5 text-sm sm:text-base">
        Login With Google
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center gap-3 my-4">
        <div className="border-b border-gray-700 w-full"></div>
        <p className="text-gray-500 text-xs sm:text-sm">OR</p>
        <div className="border-b border-gray-700 w-full"></div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 sm:p-3 rounded-lg mb-4 text-xs sm:text-sm text-center">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 mt-6">

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
            <>Login <BsArrowRight className="w-4 h-4" /></>
          )}
        </button>

      </form>

      {/* Bottom */}
      <p className="text-center text-gray-500 mt-4 sm:mt-6 text-xs sm:text-sm font-main tracking-wide">
        Don’t have an account?
        <Link to={"/signup"} className="text-pink-500 font-secondary font-bold ml-1">
          Sign up
        </Link>
      </p>

    </div>

  </div>
</div>
    )
}

export default Login