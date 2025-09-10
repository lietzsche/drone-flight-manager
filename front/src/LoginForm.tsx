import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function LoginForm() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data && typeof data.token === 'string') {
          localStorage.setItem('token', data.token)
          setUsername('')
          setPassword('')
          navigate('/')
        } else {
          setMessage('Invalid response from server')
        }
      } else if (res.status === 401) {
        setMessage('Invalid credentials')
      } else {
        setMessage('Login failed')
      }
    } catch {
      setMessage('Network error: unable to connect')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="form-field"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="form-field"
      />
      <button type="submit" className="button-primary">Login</button>
      {message && <p>{message}</p>}
    </form>
  )
}

export default LoginForm

