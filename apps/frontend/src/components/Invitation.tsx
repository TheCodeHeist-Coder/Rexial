import { GiCandlebright } from "react-icons/gi"

function Invitation() {
    return (
        <div className="text-gray-50 flex items-center justify-between text-5xl max-w-360 m-auto  border-none py-18 px-8">

            <div className="right flex flex-col gap-6">

                <div className="small-heading">
                    <p className="capitalize text-pink-600 text-lg font-secondary font-extrabold tracking-wider pl-2"> Better Together </p>
                </div>

                <div className="title">
                    <h1 className="text-6xl tracking-wider font-semibold font-secondary max-w-126"> Curate with your collectives </h1>
                </div>

                <div className="desc font-main text-lg font-medium text-gray-400 max-w-136">
                    <p> Plateform management should not be a solo endeavor. Invite co-organizers via email to help you manage vaults, edit questions, and monitor real-time streams </p>
                </div>

                <div className="points flex flex-col gap-2 font-secondary text-sm font-bold text-gray-300 tracking-widest">

                    <div className="flex items-center gap-2"> <GiCandlebright className="w-5 h-5 text-pink-500" /> Instant email invitation </div>
                    <div className="flex items-center gap-2">  <GiCandlebright className="w-5 h-5 text-rose-500" /> Granular permission controlls </div>
                    <div className="flex items-center gap-2">  <GiCandlebright className="w-5 h-5 text-red-300" /> Shared vault management </div>

                </div>

            </div>


            <div className="left"> 
                
                <div className=" flex flex-col gap-4 rounded-xl py-2 px-6  bg-black drop-shadow-sm drop-shadow-rose-500">

                    <div className="heading">
                        <h2 className="text-lg font-secondary font-bold tracking-wider pt-2 text-gray-200 "> Invite Co-organizers </h2>
                    </div>

                    <div className="content font-main flex items-center gap-3">
                        <input className="border border-pink-950 w-96 outline-none rounded-xl text-lg px-3 py-3" type="text" placeholder="co-organizer's mail" />

                        <button className="bg-linear-to-l active:scale-95 transition duration-200 from-pink-400 to-pink-600 text-xl tracking-wider  font-bold py-3 px-8 cursor-pointer rounded-xl hover:bg-pink-600 text-black"> Invite </button>
                    </div>

                    <div className="bottom py-2">
                        <div className=" h-px bg-linear-to-r from-transparent via-gray-500 to-transparent">  </div>
                         
                         <div className="pending uppercase text-sm pt-4 mb-4 pl-2 text-gray-400 font-secondary font-semibold tracking-wider"> <p> Pending Access </p> </div>

                         <div className="name flex items-center justify-between px-4 bg-gray-950 h-12 rounded-full font-main">
                            
                            <div className="text-lg font-semibold text-gray-400  bg-gray-950 p-1 px-2 rounded-full"> RK </div>

                            <div className="eamil text-sm tracking-widest text-gray-400 font-extrabold"> rajkumar@host.com </div>

                            <div className="status text-sm bg-rose-700 px-3 rounded-full py-1 flex items-center justify-center text-black font-semibold tracking-wide"> pending </div>

                         </div>

                    </div>

                </div>
                
                
                 </div>

        </div>
    )
}

export default Invitation