// Resolve API base URL: in dev, prefer proxy ('') unless explicitly set
export const BASE_URL = (() => {
  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
  if (!envBase) return ''
  try {
    const u = new URL(envBase)
    // If someone mistakenly points to the dev server (5173), fall back to proxy
    if (u.port === '5173') return ''
  } catch {
    // ignore invalid URL, use as-is
  }
  return envBase
})()

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

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
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

// Schedules
export type ScheduleStatus = 'PLANNED' | 'CONFIRMED' | 'CANCELLED'

export interface FlightSchedule {
  id: number
  ownerId: number
  title: string
  description?: string
  startsAt: string
  endsAt: string
  locationName?: string
  lat?: number
  lng?: number
  status: ScheduleStatus
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
}

export async function getSchedules(params: {
  from: string
  to: string
  page?: number
  size?: number
}): Promise<Page<FlightSchedule>> {
  const qs = new URLSearchParams({ from: params.from, to: params.to })
  if (params.page != null) qs.set('page', String(params.page))
  if (params.size != null) qs.set('size', String(params.size))
  const res = await fetch(`${BASE_URL}/api/schedules?${qs.toString()}`, { headers: { ...authHeaders() } })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({} as any))
    throw new Error((data as any).message || 'Invalid date range')
  }
  if (res.status === 401) throw new Error('Login required')
  if (!res.ok) throw new Error('Failed to fetch schedules')
  return res.json()
}

export async function createSchedule(payload: Omit<FlightSchedule, 'id' | 'ownerId'>): Promise<FlightSchedule> {
  const res = await fetch(`${BASE_URL}/api/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({} as any))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (!res.ok) throw new Error('Failed to create schedule')
  return res.json()
}

export async function updateSchedule(id: number, payload: Partial<Omit<FlightSchedule, 'id' | 'ownerId'>>): Promise<FlightSchedule> {
  const res = await fetch(`${BASE_URL}/api/schedules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({} as any))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 403) throw new Error('No permission')
  if (res.status === 404) throw new Error('Schedule not found')
  if (!res.ok) throw new Error('Failed to update schedule')
  return res.json()
}

export async function updateScheduleStatus(id: number, status: ScheduleStatus): Promise<FlightSchedule> {
  const res = await fetch(`${BASE_URL}/api/schedules/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({} as any))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 403) throw new Error('No permission')
  if (res.status === 404) throw new Error('Schedule not found')
  if (!res.ok) throw new Error('Failed to update status')
  return res.json()
}

export async function deleteSchedule(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/schedules/${id}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 403) throw new Error('No permission')
  if (res.status === 404) throw new Error('Schedule not found')
  if (!res.ok) throw new Error('Failed to delete schedule')
}

export type FlightZoneType = 'PROHIBITED' | 'RESTRICTED' | 'CAUTION'

export interface FlightZone {
  id: number
  name: string
  type: FlightZoneType
  altitudeLimit?: number | null
  timeWindow?: string | null
  geojson: string
  createdAt: string
  updatedAt: string
}

export type FlightZonePayload = {
  name?: string
  type?: FlightZoneType
  altitudeLimit?: number | null
  timeWindow?: string | null
  geojson?: string
}

export type CreateFlightZonePayload = FlightZonePayload & {
  name: string
  type: FlightZoneType
  geojson: string
}

export async function getFlightZones(): Promise<FlightZone[]> {
  const res = await fetch(`${BASE_URL}/api/flight-zones`, { headers: { ...authHeaders() } })
  if (!res.ok) throw new Error('Failed to fetch flight zones')
  return res.json()
}

export async function getFlightZone(id: number): Promise<FlightZone> {
  const res = await fetch(`${BASE_URL}/api/flight-zones/${id}`, { headers: { ...authHeaders() } })
  if (res.status === 404) throw new Error('Flight zone not found')
  if (!res.ok) throw new Error('Failed to fetch flight zone')
  return res.json()
}

export async function createFlightZone(
  payload: CreateFlightZonePayload,
): Promise<FlightZone> {
  const res = await fetch(`${BASE_URL}/api/flight-zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({} as any))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (!res.ok) throw new Error('Failed to create flight zone')
  return res.json()
}

export async function updateFlightZone(id: number, payload: FlightZonePayload): Promise<FlightZone> {
  const res = await fetch(`${BASE_URL}/api/flight-zones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (res.status === 400) {
    const data = await res.json().catch(() => ({} as any))
    throw new Error((data as any).message || 'Validation failed')
  }
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 404) throw new Error('Flight zone not found')
  if (!res.ok) throw new Error('Failed to update flight zone')
  return res.json()
}

export async function deleteFlightZone(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/flight-zones/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (res.status === 401) throw new Error('Login required')
  if (res.status === 404) throw new Error('Flight zone not found')
  if (!res.ok) throw new Error('Failed to delete flight zone')
}