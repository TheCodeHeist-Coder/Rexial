
interface Iprops {
    number: number,
    title: string,
    description: string
}

function Steps({number, title, description}:Iprops) {
  return (
    <div className="py-8 flex flex-col gap-4">
        <div className="stepnumber font-special text-pink-200 pl-4"> {number} </div>

        <div className="title font-secondary font-semibold tracking-wide bg-clip-text text-transparent bg-linear-to-b from-pink-300 to-pink-500">  ' {title} ' </div>

        <div className="about font-main text-gray-300 font-light text-[17px] tracking-wide  max-w-92"> {description} </div>

    
    </div>
  )
}

export default Steps