import { GiCelebrationFire } from "react-icons/gi"
import { RiProgress6Line } from "react-icons/ri"

function Badge() {
  return (


    <div className="relative group">

      <div className="absolute inset-0 bg-linear-to-r from-pink-600 to-purple-600 rounded-lg blur-sm opacity-40 group-hover:opacity-70 transition duration-700 group-hover:duration-200"></div>


      <div className="relative flex items-center text-white rounded-lg px-7 py-3 bg-black leading-none ">

        <p className="group-hover:text-gray-400 transition duration-200 flex items-center gap-3 text-lg text-gray-100 font-secondary tracking-wider"> <GiCelebrationFire className="h-6 w-6  text-rose-500 animate-pulse" /> Version-v1 </p>
        <span className="pr-5 pl-5 text-gray-600"> | </span>
        <p className="group-hover:text-indigo-600 transition duration-200 text-indigo-400 flex items-center gap-2 font-secondary text-lg tracking-wider"> v2 - In Progress <RiProgress6Line className="h-6 w-6  text-indigo-500 animate-pulse" /> </p>

      </div>
    </div>


  )
}

export default Badge