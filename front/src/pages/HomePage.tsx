import { Link } from 'react-router-dom'

function HomePage() {
  return (
    <div className="main-container text-center">
      <h1 className="text-3xl font-semibold mb-6">Welcome</h1>
      <div className="flex justify-center gap-6">
        <Link to="/login" className="link">
          Login
        </Link>
        <Link to="/register" className="link">
          Register
        </Link>
        <Link to="/boards" className="link">
          Board
        </Link>
      </div>
    </div>
  )
}

export default HomePage
