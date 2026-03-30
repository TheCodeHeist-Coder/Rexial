import { BsGithub } from "react-icons/bs"
import { Link } from "react-router-dom"

function Navbar() {
    return (
        <div className=" px-4 py-6 sticky top-0 z-40">

            <div className="nav bg-black/95  flex items-center justify-between px-10 border-[0.1px] border-b-cyan-500 rounded-4xl max-w-360 mx-auto h-15 ">
                <div className="logo  font-special text-4xl font-bold  tracking-wider bg-clip-text text-transparent bg-linear-to-t from-pink-400 to-pink-50"> Qtrive </div>

                <div className="right flex items-center gap-15">
                    <div className="github text-gray-300 ">
                        <a className="flex items-center gap-2 hover:text-white text-md" href="https://github.com/TheCodeHeist-Coder/Qtrive" target="_blannk"> <BsGithub className="w-5 h-5" /> Github</a>
                    </div>

                    <div className="flex items-center gap-5">
                        <Link to={"/host-quiz"} className="host  font-secondary font-semibold border border-pink-500 hover:border-pink-700 px-6 py-1 rounded-full text-xl text-pink-600"> Host </Link>

                        <Link to={"/login"} className="login text-white border border-gray-200 py-1 px-6 fron-semibold font-secondary rounded-full text-xl"> Login </Link>
                    </div>
                </div>


            </div>

        </div>
    )
}

export default Navbar