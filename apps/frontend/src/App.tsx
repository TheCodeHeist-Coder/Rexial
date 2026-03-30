import {BrowserRouter, Route, Routes} from 'react-router-dom'
import LandingPage from './screens/LandingPage'
import Signup from './screens/Signup'

function App() {

  return (
    <BrowserRouter>
        <Routes>
           <Route path='/' element={<LandingPage />} />
           <Route path='/signup' element={<Signup />} />

        </Routes>
    </BrowserRouter>
  )

}

export default App
