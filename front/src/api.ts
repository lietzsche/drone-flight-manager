const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || ''

export interface Post {
  id: number
  title: string
  content: string
  author: string
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: number
  content: string
  author: string
  createdAt: string
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getPosts(): Promise<Post[]> {
  const res = await fetch(`${BASE_URL}/api/boards`)
  if (!res.ok) throw new Error('Failed to fetch posts')
  return res.json()
}

export async function getPost(id: number): Promise<Post> {
  const res = await fetch(`${BASE_URL}/api/boards/${id}`)
  if (res.status === 404) throw new Error('Not found')
  if (!res.ok) throw new Error('Failed to fetch post')
  return res.json()
}

export async function createPost(payload: { title: string; content: string }): Promise<Post> {
  const res = await fetch(`${BASE_URL}/api/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (!res.ok) throw new Error('Failed to create post')
  return res.json()
}

export async function updatePost(
  id: number,
  payload: { title?: string; content?: string },
): Promise<Post> {
  const res = await fetch(`${BASE_URL}/api/boards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 403) throw new Error('Only the author can edit')
  if (res.status === 404) throw new Error('Post not found')
  if (!res.ok) throw new Error('Failed to update post')
  return res.json()
}

export async function deletePost(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/boards/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 403) throw new Error('Only the author can delete')
  if (res.status === 404) throw new Error('Post not found')
  if (!res.ok) throw new Error('Failed to delete post')
}

export async function getComments(postId: number): Promise<Comment[]> {
  const res = await fetch(`${BASE_URL}/api/boards/${postId}/comments`)
  if (res.status === 404) throw new Error('Post not found')
  if (!res.ok) throw new Error('Failed to fetch comments')
  return res.json()
}

export async function addComment(postId: number, payload: { content: string }): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/api/boards/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 404) throw new Error('Post not found')
  if (!res.ok) throw new Error('Failed to add comment')
  return res.json()
}

export async function deleteComment(postId: number, id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/boards/${postId}/comments/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 403) throw new Error('Only the author can delete')
  if (res.status === 404) throw new Error('Comment not found')
  if (!res.ok) throw new Error('Failed to delete comment')
}

export async function getReplies(postId: number, commentId: number): Promise<Comment[]> {
  const res = await fetch(`${BASE_URL}/api/boards/${postId}/comments/${commentId}/replies`)
  if (res.status === 404) throw new Error('Comment or post not found')
  if (!res.ok) throw new Error('Failed to fetch replies')
  return res.json()
}

export async function addReply(
  postId: number,
  commentId: number,
  payload: { content: string },
): Promise<Comment> {
  const res = await fetch(`${BASE_URL}/api/boards/${postId}/comments/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 404) throw new Error('Comment or post not found')
  if (!res.ok) throw new Error('Failed to add reply')
  return res.json()
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('token')
}
