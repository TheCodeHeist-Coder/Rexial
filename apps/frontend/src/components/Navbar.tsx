import { BsGithub } from "react-icons/bs"
import { Link } from "react-router-dom"
import { useAuthStore } from "../store/authStore"

function Navbar() {

    const { user } = useAuthStore();


    return (
        <div className="px-3 sm:px-4 py-4 sticky top-0 z-40">
            <div className="nav bg-black/95 flex items-center justify-between px-4 sm:px-6 md:px-10 border border-b-rose-800 rounded-2xl sm:rounded-full max-w-7xl mx-auto h-14 sm:h-16">

                {/* Logo */}
                <div className="logo font-special text-xl sm:text-2xl md:text-4xl font-bold tracking-wider bg-clip-text text-transparent bg-linear-to-t from-pink-600 to-pink-300">
                    Qtrive
                </div>

                {/* Right Section */}
                <div className="right flex items-center gap-3 sm:gap-6 md:gap-10">

                    {/* Github */}
                    <a
                        className="flex items-center gap-1 sm:gap-2 text-gray-300 hover:text-white text-xs sm:text-sm md:text-md"
                        href="https://github.com/TheCodeHeist-Coder/Qtrive"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <BsGithub className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Github</span>
                    </a>

                    {/* Buttons */}
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-5">

                        {user ? (
                            <>
                                <Link
                                    to={"/host-quiz"}
                                    className="font-secondary font-semibold border border-pink-500 hover:border-pink-700 px-3 sm:px-5 md:px-6 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm md:text-lg active:scale-90 text-pink-600 whitespace-nowrap"
                                >
                                    Host
                                </Link>

                                <Link
                                    to="/dashboard"
                                    className="font-secondary font-semibold rounded-full text-xs sm:text-sm md:text-lg bg-linear-to-r from-pink-500 to-pink-700 hover:to-pink-500 hover:from-pink-700 transition duration-200 active:scale-90 px-3 sm:px-5 md:px-6 py-1 sm:py-2 text-gray-900 whitespace-nowrap"
                                >
                                    Dashboard
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="font-secondary font-semibold border border-pink-500 hover:border-pink-700 px-3 sm:px-5 md:px-6 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm md:text-lg active:scale-90 text-pink-600 whitespace-nowrap"
                                >
                                    Login
                                </Link>

                                <Link
                                    to="/signup"
                                    className="font-secondary font-semibold rounded-full text-xs sm:text-sm md:text-lg bg-linear-to-r from-pink-500 to-pink-700 hover:to-pink-500 hover:from-pink-700 transition duration-200 active:scale-90 px-3 sm:px-5 md:px-6 py-1 sm:py-1.5 text-gray-900 whitespace-nowrap"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </div>
    )
}

export default Navbar