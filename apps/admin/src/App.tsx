import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { auth } from './lib/api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Sessions from './pages/Sessions'
import SessionDetail from './pages/SessionDetail'
import Quizzes from './pages/Quizzes'
import QuizDetail from './pages/QuizDetail'
import Users from './pages/Users'
import UserDetail from './pages/UserDetail'
import Traffic from './pages/Traffic'

function RequireAdmin({ children }: { children: ReactNode }) {
  return auth.token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAdmin><Layout /></RequireAdmin>}>
          <Route index element={<Overview />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="quizzes" element={<Quizzes />} />
          <Route path="quizzes/:id" element={<QuizDetail />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<UserDetail />} />
          <Route path="traffic" element={<Traffic />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
