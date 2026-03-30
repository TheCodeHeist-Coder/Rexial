import Steps from "../smallUnits.tsx/Steps"
import Heading from "./Heading"

function Flow() {
  return (
    <div className="text-3xl bg-none  max-w-360 m-auto font-semibold text-white py-16">

      <div className="heading text-center"> <Heading />  </div>


      <div className="steps flex items-center justify-between py-5">

        <div className="step-1"> <Steps number={0o1} title="Design Your Archive" description="Hosts create quizzes and invite co-organizers to curate the experience." /> </div>
        <div className="step-2"> <Steps number={0o2} title="Ignite The Pulse" description="Generate a unique code and go live with instant real-time interaction." /> </div>
        <div className="step-3"> <Steps number={0o3} title="Analyze The Kinetic" description="Participants join instantly while progress and results are tracked live." /> </div>

      </div>



    </div>
  )
}

export default Flow