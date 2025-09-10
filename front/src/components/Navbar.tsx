import { Link, useLocation, useNavigate } from 'react-router-dom'
import { isLoggedIn } from '../api'
import { useEffect, useState } from 'react'

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [authed, setAuthed] = useState(isLoggedIn())

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
    </nav>
  )
}

export default Navbar

