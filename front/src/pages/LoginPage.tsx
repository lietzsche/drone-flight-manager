import LoginForm from '../LoginForm'
import { Link } from 'react-router-dom'

function LoginPage() {
  return (
    <div className="main-container">
      <h2 className="text-2xl font-medium mb-4 text-center">Login</h2>
      <LoginForm />
      <p className="mt-4 text-center">
        Don't have an account?{' '}
        <Link to="/register" className="link">
          Register
        </Link>
      </p>
    </div>
  )
}

export default LoginPage
