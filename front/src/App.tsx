import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import BoardListPage from './pages/BoardListPage'
import BoardDetailPage from './pages/BoardDetailPage'
import BoardCreatePage from './pages/BoardCreatePage'
import Navbar from './components/Navbar'
import SchedulePage from './pages/SchedulePage'
import FlightZonePage from './pages/FlightZonePage'

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/boards" element={<BoardListPage />} />
        <Route path="/boards/new" element={<BoardCreatePage />} />
        <Route path="/boards/:id" element={<BoardDetailPage />} />
        <Route path="/schedules" element={<SchedulePage />} />
        <Route path="/flight-zones" element={<FlightZonePage />} />
      </Routes>
    </>
  )
}

export default App
