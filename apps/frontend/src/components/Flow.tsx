import Steps from "../smallUnits.tsx/Steps"
import Heading from "./Heading"

function Flow() {
  return (
  <div className="text-white max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-18 font-semibold">

  {/* Heading */}
  <div className="heading text-center mb-8 sm:mb-12">
    <Heading />
  </div>

  {/* Steps */}
  <div className="steps grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">

    <div className="step-1">
      <Steps
        number={1}
        title="Design Your Archive"
        description="Hosts create quizzes and invite co-organizers to curate the experience."
      />
    </div>

    <div className="step-2">
      <Steps
        number={2}
        title="Ignite The Pulse"
        description="Generate a unique code and go live with instant real-time interaction."
      />
    </div>

    <div className="step-3">
      <Steps
        number={3}
        title="Analyze The Kinetic"
        description="Participants join instantly while progress and results are tracked live."
      />
    </div>

  </div>

</div>
  )
}

export default Flow