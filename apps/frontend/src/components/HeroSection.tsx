import { IoIosKey } from "react-icons/io"
import Badge from "./Badge"
import { Link } from "react-router-dom"
import { GiFallingStar } from "react-icons/gi"
import { BsWrenchAdjustable } from "react-icons/bs"
import { useAuthStore } from "../store/authStore"

function HeroSection() {

    const { user } = useAuthStore();

    return (
        <div className="text-white flex flex-col items-center mt-16 max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-28 pt-6">

            {/* Badge */}
            <div className="badge mt-10 sm:mt-16">
                <Badge />
            </div>

            {/* Main Text */}
            <div className="maintext mt-10 sm:mt-14 font-secondary text-center">

                <p className="text-sm sm:text-lg md:text-xl mb-3 sm:mb-4 tracking-wider text-rose-500">
                    The Kinetic Archive
                </p>

                <h1 className="text-[36px] sm:text-5xl md:text-7xl lg:text-9xl text-gray-300 tracking-wide leading-tight">
                    Where Knowledge
                </h1>

                <h1 className="text-[36px] sm:text-4xl md:text-6xl lg:text-8xl text-pink-400 drop-shadow-md drop-shadow-pink-950 mt-1 sm:mt-2">
                    Comes Alive
                </h1>

                <p className="max-w-md sm:max-w-2xl  mx-auto mt-4 sm:mt-6 text-[16px] sm:text-base md:text-lg text-gray-400 font-main tracking-wide px-2">
                    Experience the next evolution of interactive learning and compete with your friends.
                    Join live challenges, build your archive, and ignite your curiosity in our obsidian-themed universe.
                </p>
            </div>

            {/* Join Quiz */}
            <div className="joinQuiz w-full max-w-md sm:max-w-xl mt-10 sm:mt-14 bg-black py-3 px-2 rounded-full shadow-sm shadow-rose-600/30">

                <div className="flex items-center justify-between gap-2 sm:gap-4">

                    <div className="flex items-center gap-3 sm:gap-3 flex-1 px-2">
                        <IoIosKey className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />

                        <input
                            className="py-2 sm:py-3 w-full bg-transparent outline-none text-sm sm:text-base"
                            type="text"
                            placeholder="Enter Quiz Code"
                        />
                    </div>

                    <button className="bg-linear-to-l from-pink-400 to-pink-700 px-10 sm:px-12 py-5 sm:py-4 font-special tracking-wide text-gray-950 active:scale-95 transition duration-100 cursor-pointer rounded-full text-sm sm:text-lg whitespace-nowrap">
                        Join
                    </button>

                </div>
            </div>

            {/* Bottom Links */}
            <div className="bottom flex flex-col sm:flex-row items-center gap-4 sm:gap-10 mt-8 sm:mt-10 font-secondary text-center sm:text-left">

                <div>
                    <p className="text-gray-400 flex items-center justify-center sm:justify-start gap-2 text-sm sm:text-base">
                        <GiFallingStar className="text-rose-600 w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                        Ready to lead?
                        <Link
                            to={user ? "/host-quiz" : "/login"}
                            className="text-rose-500 font-semibold pl-1 hover:text-rose-700"
                        >
                            Host a Quiz
                        </Link>
                    </p>
                </div>

                <div>
                    <p className="text-gray-400 flex items-center justify-center sm:justify-start gap-2 text-sm sm:text-base">
                        <BsWrenchAdjustable className="text-cyan-600 w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                        {user ? "Already in?" : "New here?"}
                        <Link
                            to={user ? "/dashboard" : "/signup"}
                            className="text-cyan-500 font-semibold pl-1 hover:text-cyan-700"
                        >
                            {user ? "Enjoy..." : "Sign Up"}
                        </Link>
                    </p>
                </div>

            </div>

        </div>
    )
}

export default HeroSection