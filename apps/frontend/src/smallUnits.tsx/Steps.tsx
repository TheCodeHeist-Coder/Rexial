
interface Iprops {
    number: number,
    title: string,
    description: string
}

function Steps({number, title, description}:Iprops) {
  return (
   <div className="py-5 sm:py-6 flex flex-col gap-3 sm:gap-4 border border-b-rose-600 border-black/80 bg-zinc-900 px-4 sm:px-6 rounded-2xl hover:shadow-md transition duration-200">

  {/* Step Number */}
  <div className="stepnumber font-special text-pink-300 text-2xl sm:text-xl md:text-4xl">
    {number}
  </div>

  {/* Title */}
  <div className="title font-secondary font-semibold tracking-wide bg-clip-text text-transparent bg-linear-to-b from-pink-300 to-pink-500 text-md sm:text-base md:text-2xl">
    "{title}"
  </div>

  {/* Description */}
  <div className="about font-main text-gray-300 font-light text-xs sm:text-sm md:text-base tracking-wide leading-relaxed max-w-full sm:max-w-md">
    {description}
  </div>

</div>
  )
}

export default Steps