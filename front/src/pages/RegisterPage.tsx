import RegisterForm from '../RegisterForm'
import { Link } from 'react-router-dom'

function RegisterPage() {
  return (
    <div className="main-container">
      <h2 className="text-2xl font-medium mb-4 text-center">Register</h2>
      <RegisterForm />
      <p className="mt-4 text-center">
        Already have an account?{' '}
        <Link to="/login" className="link">
          Login
        </Link>
      </p>
    </div>
  )
}

export default RegisterPage
