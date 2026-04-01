import { FaArrowRightToBracket } from "react-icons/fa6"
import BgBoss from "../components/BgBoss"
import { Link } from 'react-router-dom'

function Dashboard() {
  return (
    <div className="w-full min-h-screen  bg-[#000000]/98 opacity-99">
      <BgBoss opacity="opacity-8" />

      {/* Simple navbar */}

      <div className=" sticky top-0  nav max-w-7xl m-auto py-6 px-8 flex items-center justify-between">

        <div className="absolute bottom-0 h-px bg-linear-to-l from-transparent via-pink-900 to-transparent inset-x-0.5">  </div>

        <div className="logo-home">
          <Link to={"/"} className="logo  font-special text-4xl font-bold  tracking-wider bg-clip-text text-transparent bg-linear-to-t from-pink-600 to-pink-300"> Qtrive </Link>
        </div>

        <div className="logout-name flex items-center gap-4 ">

          <p className="font-secondary text-gray-300 text-xl tracking-wide"> Hii, <span className="pl-2 text-pink-700 font-bold"> Rajkumar </span> </p>

          <button className="font-secondary font-semibold border border-rose-600 cursor-pointer active:scale-95 transition duration-100 hover:text-rose-400 py-1.5 px-5 rounded-xl text-rose-700 flex items-center gap-2 bg-rose-700/10 hover:bg-rose-700/20">  Logout <FaArrowRightToBracket /> </button>

        </div>

      </div>


      {/* organized quizzes */}

      <div className="organized-quizzes ">


      </div>


      {/* participated quiz */}

      <div className="participated quiz ">

      </div>








    </div>
  )
}

export default Dashboard