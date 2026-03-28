import BgBoss from "../components/BgBoss"
import Navbar from "../components/Navbar"

function LandingPage() {
  return (
   <div className="min-h-screen w-full  bg-[#000000]/98 opacity-99">
    <BgBoss opacity="opacity-8" />

    {/* Navbar */}
    <Navbar />

   </div>
  )
}

export default LandingPage