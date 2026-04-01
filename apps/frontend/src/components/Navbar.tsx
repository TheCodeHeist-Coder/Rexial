import { BsGithub } from "react-icons/bs"
import { Link } from "react-router-dom"
import { useAuthStore } from "../store/authStore"

function Navbar() {

    const { user } = useAuthStore();


    return (
        <div className=" px-4 py-6 sticky top-0 z-40">

            <div className="nav bg-black/95  flex items-center justify-between px-10 border border-b-rose-800 rounded-4xl max-w-360 mx-auto h-15 ">
                <div className="logo  font-special text-4xl font-bold  tracking-wider bg-clip-text text-transparent bg-linear-to-t from-pink-600 to-pink-300"> Qtrive </div>

                <div className="right flex items-center gap-15">
                    <div className="github text-gray-300 ">
                        <a className="flex items-center gap-2 hover:text-white text-md" href="https://github.com/TheCodeHeist-Coder/Qtrive" target="_blannk"> <BsGithub className="w-5 h-5" /> Github</a>
                    </div>

                    <div className="flex items-center gap-5">

                        {user ? (
                            <>
                                <Link to={"/host-quiz"} className="host  font-secondary font-semibold border border-pink-500 hover:border-pink-700 px-6 py-1.5 rounded-full text-xl active:scale-90 text-pink-600"> Host </Link>
                                <Link to="/dashboard" className=" py-2 font-secondary  font-semibold rounded-full text-xl bg-linear-to-r from-pink-500 to-pink-700 hover:to-pink-500 hover:from-pink-700 transition duration-200 active:scale-90 px-6 text-gray-900 ">Dashboard</Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="font-secondary font-semibold border border-pink-500 hover:border-pink-700 px-6 py-1.5 rounded-full text-xl active:scale-90 text-pink-600">Login</Link>
                                <Link to="/signup" className=" py-1.5 font-secondary  font-semibold rounded-full text-xl bg-linear-to-r from-pink-500 to-pink-700 hover:to-pink-500 hover:from-pink-700 transition duration-200 active:scale-90 px-6 text-gray-900 ">Get Started</Link>
                            </>
                        )

                        }


                    </div>
                </div>


            </div>

        </div>
    )
}

export default Navbar