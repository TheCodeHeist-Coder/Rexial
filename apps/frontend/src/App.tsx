import {BrowserRouter, Route, Routes} from 'react-router-dom'
import LandingPage from './screens/LandingPage'
import Signup from './screens/Signup'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import QuizBuilder from './screens/QuizBuilder'

function App() {

  return (
    <BrowserRouter>
        <Routes>
           <Route path='/' element={<LandingPage />} />
           <Route path='/signup' element={<Signup />} />
           <Route path='/login' element={<Login />} />
           <Route path='/dashboard' element={<Dashboard />} />
           <Route path='/quiz/:id/edit' element={<QuizBuilder />} />

        </Routes>
    </BrowserRouter>
  )

}

export default App
