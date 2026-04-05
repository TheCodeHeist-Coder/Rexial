import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LandingPage from './screens/LandingPage'
import Signup from './screens/Signup'
import Login from './screens/Login'
import Dashboard from './screens/Dashboard'
import QuizBuilder from './screens/QuizBuilder'
import ProtectedRoute from './services/ProtectedRoute'
import LiveQuiz from './screens/LiveQuiz'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        
        <Route path='/' element={<LandingPage />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/login' element={<Login />} />
        <Route path='/quiz/manage/:sessionId' element={<LiveQuiz />} />
        <Route path='/dashboard' element={<ProtectedRoute> <Dashboard /> </ProtectedRoute>} />
        <Route path='/quiz/:id/edit' element={<ProtectedRoute> <QuizBuilder /> </ProtectedRoute>} />

      </Routes>
    </BrowserRouter>
  )

}

export default App
