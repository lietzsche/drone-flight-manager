import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isLoggedIn } from '../api'
import { useEffect, useState } from 'react'
import FlightAreaPanel from './FlightAreaPanel'

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [authed, setAuthed] = useState(isLoggedIn())
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    setAuthed(isLoggedIn())
  }, [location.pathname])

  const handleLogout = () => {
    localStorage.removeItem('token')
    setAuthed(false)
    navigate('/')
  }

  return (
    <nav className="bg-white shadow">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="font-semibold">Bion</Link>
          <Link to="/boards" className="link">Board</Link>
          <Link to="/schedules" className="link">Schedules</Link>
          <Link to="/flight-zones" className="link">Flight Zones</Link>
          <button onClick={() => setShowPanel((s) => !s)} className="link text-left">비행 가능지역 확인</button>
        </div>
        <div className="flex items-center gap-3">
          {!authed ? (
            <>
              <Link to="/login" className="link">Login</Link>
              <Link to="/register" className="link">Register</Link>
            </>
          ) : (
            <button onClick={handleLogout} className="text-sm border rounded px-3 py-1">Logout</button>
          )}
        </div>
      </div>
      {showPanel && <FlightAreaPanel onClose={() => setShowPanel(false)} />}
    </nav>
  )
}

export default Navbar
