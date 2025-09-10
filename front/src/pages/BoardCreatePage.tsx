import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createPost, isLoggedIn } from '../api'

function BoardCreatePage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    try {
      const post = await createPost({ title, content })
      navigate(`/boards/${post.id}`)
    } catch (e: any) {
      setMessage(e.message || 'Failed to create')
    }
  }

  if (!isLoggedIn()) {
    return (
      <div className="main-container">
        <p>You must be logged in to create a post.</p>
        <Link to="/login" className="link">Go to Login</Link>
      </div>
    )
  }

  return (
    <div className="main-container">
      <div className="mb-4">
        <Link to="/boards" className="link">← Back to list</Link>
      </div>
      <h2 className="text-2xl font-medium mb-4">New Post</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="form-field"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="form-field min-h-60"
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <button type="submit" className="button-primary">Create</button>
        {message && <p className="text-red-600">{message}</p>}
      </form>
    </div>
  )
}

export default BoardCreatePage

