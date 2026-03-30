import BgBoss from "../components/BgBoss"
import Flow from "../components/Flow"
import HeroSection from "../components/HeroSection"
import Invitation from "../components/Invitation"
import Navbar from "../components/Navbar"

function LandingPage() {
  return (
   <div className="min-h-screen w-full  bg-[#000000]/98 opacity-99">
    <BgBoss opacity="opacity-8" />

    {/* Navbar */}
    <Navbar />

    {/* Herosection */}
    <HeroSection />

    {/* flow of application */}
    <Flow />

    {/* Invitiion INfo */}
    <Invitation />

   </div>
  )
}

export default LandingPage