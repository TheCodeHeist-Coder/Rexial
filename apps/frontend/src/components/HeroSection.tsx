import { IoIosKey } from "react-icons/io"
import Badge from "./Badge"
import { Link } from "react-router-dom"
import { GiFallingStar } from "react-icons/gi"
import { BsWrenchAdjustable } from "react-icons/bs"

function HeroSection() {
    return (
        <div className="text-white flex flex-col items-center max-w-380 m-auto pb-18  ">

            <div className="badge mt-18">
                <Badge />
            </div>

            <div className="maintext mt-16 font-secondary text-center">
                <p className="text-xl mb-4 tracking-wider text-rose-500"> The Kinetic Archive </p>


                <h1 className="text-9xl text-gray-300 tracking-wide"> Where Knowledge </h1>
                <h1 className="text-pink-400 drop-shadow-md drop-shadow-pink-950 text-8xl mt-2"> Comes Alive </h1>


                <p className="max-w-169 m-auto mt-5 text-lg drop-shadow-md drop-shadow-pink-900 text-gray-400 
              font-main tracking-wider"> Experience the next evolution of interactive learning and compete with your friends. Join live challanges, build your archive, and ignite your curiosity in our obsidian-themed universe </p>
            </div>


            {/* Input box for code-quiz */}
            <div className="joinQuiz drop-shadow-sm  drop-shadow-rose-600 bg-black mt-15 py-1 pl-4 pr-1 rounded-full">

                <div className="flex gap-20">
                    <div className="flex items-center gap-3 pr-12">
                        <IoIosKey className="w-6 h-6 text-gray-400" />

                        <input className="py-5 outline-none" type="text" name="" id="" placeholder="Enter Quiz Code" />
                    </div>


                    <button className="bg-linear-to-l px-12 py-0  font-special tracking-wide text-gray-950 active:scale-95 transition duration-100 cursor-pointer rounded-full from-pink-400 to-pink-700 text-2xl"> Join </button>
                </div>

            </div>


            <div className="bottom flex font-secondary items-center w-135 mt-10 justify-between">
                <div className="left">
                    <p className="text-gray-400 flex items-center gap-2 "> <GiFallingStar className="text-rose-600 w-7 h-7 animate-pulse mb-2" /> Ready to lead? <Link to={"/host-quiz"} className="text-rose-500 font-semibold pl-2 hover:text-rose-700"> Host a Quiz </Link> </p>
                </div>


                <div className="left">
                    <p className="text-gray-400 flex items-center gap-2 "> <BsWrenchAdjustable className="text-cyan-600 w-6 h-6 animate-pulse " /> Ready to lead? <Link to={"/host-quiz"} className="text-cyan-500 font-semibold pl-2 hover:text-cyan-700"> Sign Up </Link> </p>
                </div>

            </div>



        </div>
    )
}

export default HeroSection