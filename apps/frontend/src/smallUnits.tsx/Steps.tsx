
interface Iprops {
    number: number,
    title: string,
    description: string
}

function Steps({number, title, description}:Iprops) {
  return (
    <div className=" py-6 flex mt-4 flex-col gap-4 border border-b-rose-600  hover:shadow-md  border-black/80 bg-zinc-900  px-6 rounded-2xl">
        <div className="stepnumber font-special text-pink-300 pl-4"> {number} </div>

        <div className="title font-secondary font-semibold tracking-wide bg-clip-text text-transparent bg-linear-to-b from-pink-300 to-pink-500">  ' {title} ' </div>

        <div className="about font-main text-gray-300 font-light text-[17px] tracking-wide  max-w-92"> {description} </div>

    
    </div>
  )
}

export default Steps