import { GiCelebrationFire } from "react-icons/gi"
import { RiProgress6Line } from "react-icons/ri"

function Badge() {
  return (


 <div className="relative group w-full max-w-5xl  sm:max-w-2xl ">

  {/* Glow */}
  <div className="absolute inset-0 bg-linear-to-r from-pink-600 to-purple-600 rounded-lg blur-sm opacity-40 group-hover:opacity-70 transition duration-700 group-hover:duration-200"></div>

  {/* Content */}
  <div className="relative flex h-10 sm:h-15 sm:max-w-132  sm:flex-row items-center justify-center text-white rounded-lg px-4 sm:px-12 py-2 sm:py-3 bg-black leading-none gap-5 sm:gap-4 text-center sm:text-left">

    {/* Left */}
    <p className="group-hover:text-gray-400 transition duration-200 flex items-center gap-2 text-md sm:text-sm md:text-base text-gray-100 font-secondary tracking-wide">
      <GiCelebrationFire className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500 animate-pulse" />
      Version-v1
    </p>

    {/* Divider */}
    <span className=" sm:block  sm:px-4 text-gray-600">|</span>

    {/* Right */}
    <p className="group-hover:text-indigo-600 transition duration-200 text-indigo-400 flex items-center gap-2 font-secondary text-md sm:text-sm md:text-base tracking-wide">
      v2 - In Progress
      <RiProgress6Line className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 animate-pulse" />
    </p>

  </div>
</div>

  )
}

export default Badge