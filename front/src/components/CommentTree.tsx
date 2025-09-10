import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addReply, deleteComment, getReplies, type Comment, isLoggedIn } from '../api'

type Props = {
  postId: number
  comment: Comment
  depth?: number
  onDeleted?: (id: number) => void
}

function CommentTree({ postId, comment, depth = 0, onDeleted }: Props) {
  const authed = isLoggedIn()
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<Comment[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [replyText, setReplyText] = useState('')

  const toggle = async () => {
    const willExpand = !expanded
    setExpanded(willExpand)
    if (willExpand && children === null) {
      setLoading(true)
      try {
        const rs = await getReplies(postId, comment.id)
        setChildren(rs)
      } catch (e) {
        // eslint-disable-next-line no-alert
        alert((e as any)?.message || 'Failed to load replies')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleAddReply = async () => {
    const content = replyText.trim()
    if (!content) return
    try {
      const r = await addReply(postId, comment.id, { content })
      setChildren((prev) => (prev ? [...prev, r] : [r]))
      setExpanded(true)
      setReplyText('')
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert((e as any)?.message || 'Failed to add reply')
    }
  }

  const handleDeleteSelf = async () => {
    if (!confirm('Delete this comment?')) return
    try {
      await deleteComment(postId, comment.id)
      onDeleted?.(comment.id)
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert((e as any)?.message || 'Failed to delete')
    }
  }

  const handleChildDeleted = (id: number) => {
    setChildren((prev) => (prev ? prev.filter((c) => c.id !== id) : prev))
  }

  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="text-sm text-gray-600 mb-1">
        {comment.author} • {new Date(comment.createdAt).toLocaleString()}
      </div>
      <div className="whitespace-pre-wrap mb-2">{comment.content}</div>
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="text-sm link">
          {expanded ? 'Hide replies' : 'Show replies'}
        </button>
        {authed && (
          <button onClick={handleDeleteSelf} className="text-sm text-red-600 hover:underline">Delete</button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 ml-4 border-l pl-4 space-y-3">
          {loading && <div>Loading...</div>}
          {(children || []).map((child) => (
            <CommentTree
              key={child.id}
              postId={postId}
              comment={child}
              depth={depth + 1}
              onDeleted={handleChildDeleted}
            />
          ))}

          {authed ? (
            <div className="flex gap-2">
              <input
                className="form-field flex-1"
                placeholder="Write a reply"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <button onClick={handleAddReply} className="button-primary">Reply</button>
            </div>
          ) : (
            <p className="text-sm">Login to reply. <Link className="link" to="/login">Login</Link></p>
          )}
        </div>
      )}
    </div>
  )
}

export default CommentTree

