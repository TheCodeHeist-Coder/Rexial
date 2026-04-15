import BgBoss from "../components/BgBoss"
import Flow from "../components/Flow"
import Footer from "../components/Footer"
import HeroSection from "../components/HeroSection"
import Invitation from "../components/Invitation"
import Navbar from "../components/Navbar"

function LandingPage() {
  return (
   <div className="min-h-screen overflow-hidden w-full  bg-[#000000]/98 opacity-99 ">
    <BgBoss opacity="opacity-10" />

    {/* Navbar */}
    <Navbar />

    {/* Herosection */}
    <HeroSection />

    <div className="bg-[#000000]/60 border border-t-gray-600">

   
    {/* flow of application */}
    <Flow />

    {/* Invitiion INfo */}
    <Invitation />


    <Footer />

     </div>


   </div>
  )
}

export default LandingPage