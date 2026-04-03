import { GiCandlebright } from "react-icons/gi"

function Invitation() {
    return (
       <div className="text-gray-50 flex flex-col lg:flex-row items-center justify-between gap-10 sm:gap-40 max-w-7xl mx-auto py-8 sm:py-16 px-4 sm:px-6">

  {/* RIGHT (Text Content) */}
  <div className="right flex flex-col gap-3 sm:gap-6 w-full lg:w-1/2 text-center lg:text-left">

    <p className="capitalize text-pink-600 text-sm sm:text-base font-secondary font-extrabold tracking-wider">
      Better Together
    </p>

    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-wide font-semibold text-gray-400 font-secondary leading-tight">
      Curate with your collectives
    </h1>

    <p className="font-main text-sm sm:text-base md:text-lg font-medium text-gray-400 max-w-xl mx-auto lg:mx-0">
      Platform management should not be a solo endeavor. Invite co-organizers via email to help you manage vaults, edit questions, and monitor real-time streams.
    </p>

    <div className="points flex flex-col gap-2 font-secondary text-xs sm:text-sm font-bold text-gray-300 tracking-wide items-center lg:items-start">

      <div className="flex items-center gap-2">
        <GiCandlebright className="w-4 h-4 sm:w-5 sm:h-5 text-pink-500" />
        Instant email invitation
      </div>

      <div className="flex items-center gap-2">
        <GiCandlebright className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
        Granular permission controls
      </div>

      <div className="flex items-center gap-2">
        <GiCandlebright className="w-4 h-4 sm:w-5 sm:h-5 text-red-300" />
        Shared vault management
      </div>

    </div>
  </div>

  {/* LEFT (Card) */}
  <div className="left w-full lg:w-1/2 flex justify-center">

    <div className="flex flex-col gap-4 rounded-xl py-4 sm:py-8 px-4 sm:px-6 bg-black shadow-md shadow-rose-500/30 w-full max-w-lg">

      <h2 className="text-base sm:text-lg font-secondary font-bold tracking-wide text-gray-300">
        Invite Co-organizers
      </h2>

      {/* Input */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3">

        <input
          className="border border-pink-950 w-full outline-none rounded-lg text-sm sm:text-base px-3 py-2"
          type="text"
          placeholder="co-organizer's mail"
        />

        <button className="bg-linear-to-l from-pink-400 to-pink-600 text-sm sm:text-base font-bold py-2 px-4 sm:px-6 cursor-pointer rounded-lg hover:opacity-90 active:scale-95 transition text-black whitespace-nowrap">
          Invite
        </button>

      </div>

      {/* Divider */}
      <div className="h-px bg-linear-to-r from-transparent via-gray-500 to-transparent"></div>

      {/* Pending */}
      <p className="uppercase text-xs sm:text-sm text-gray-400 font-secondary font-semibold tracking-wider">
        Pending Access
      </p>

      {/* User Row */}
      <div className="flex items-center justify-between px-3 sm:px-4 bg-gray-950 py-2 rounded-full font-main gap-2">

        <div className="text-sm sm:text-base font-semibold text-gray-400 px-2 py-1 rounded-full">
          RK
        </div>

        <div className="text-xs sm:text-sm tracking-wide text-gray-400 font-bold truncate">
          rajkumar@host.com
        </div>

        <div className="text-xs bg-rose-700 px-2 sm:px-3 rounded-full py-1 flex items-center justify-center text-black font-semibold tracking-wide">
          pending
        </div>

      </div>

    </div>

  </div>

</div>
    )
}

export default Invitation