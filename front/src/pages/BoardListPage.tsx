import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPosts, type Post, isLoggedIn } from '../api'

function BoardListPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getPosts()
      .then((data) => {
        if (mounted) setPosts(data.sort((a, b) => b.id - a.id))
      })
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div className="main-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-medium">Board</h2>
        {isLoggedIn() ? (
          <Link to="/boards/new" className="button-primary">New Post</Link>
        ) : (
          <Link to="/login" className="link">Login to post</Link>
        )}
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && posts.length === 0 && <p>No posts yet.</p>}
      <ul className="divide-y">
        {posts.map((p) => (
          <li key={p.id} className="py-3">
            <Link to={`/boards/${p.id}`} className="link text-lg">{p.title}</Link>
            <div className="text-sm text-gray-600">by {p.author} • {new Date(p.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default BoardListPage

