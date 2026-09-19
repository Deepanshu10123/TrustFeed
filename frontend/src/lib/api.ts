/**
 * Thin wrapper around the FastAPI backend. Every call attaches the
 * current Supabase session's access token -- our API never issues its
 * own tokens, it only ever verifies the one Supabase already gave us.
 */
import { supabase } from './supabase'
import type { Comment, Post, PostKind, PostStatus } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return token
}

async function authHeader(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getAccessToken()}` }
}

/** The stream endpoint's URL, token as a query param -- the browser's
 * native EventSource can't send an Authorization header, so this is the
 * standard workaround for that specific limitation (see Milestone 7b). */
export async function progressStreamUrl(postId: string): Promise<string> {
  const token = await getAccessToken()
  return `${API_BASE_URL}/posts/${postId}/stream?token=${encodeURIComponent(token)}`
}

/** What to show for a failed request: the API's own plain-language `detail`
 * when it sent one ("You've used all 5 video uploads..."), otherwise the raw
 * status and body. */
function errorMessage(status: number, statusText: string, body: string): string {
  try {
    const detail = JSON.parse(body).detail
    if (typeof detail === 'string') return detail
  } catch {
    // not JSON -- fall through to the raw text
  }
  return `${status} ${statusText}: ${body}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await authHeader()), ...(init?.headers ?? {}) }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    throw new Error(errorMessage(response.status, response.statusText, await response.text()))
  }
  return response.json()
}

export interface UploadProgress {
  percent: number // 0-100 of the file that has left the browser
  sent: boolean // all of it has -- the server still has work to do before it answers
}

/** fetch can't say how much of an upload has gone out, XMLHttpRequest can --
 * so video uploads go this way to drive the progress bar. */
async function uploadWithProgress<T>(path: string, form: FormData, onProgress: (p: UploadProgress) => void): Promise<T> {
  const token = await getAccessToken()
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress({ percent: Math.round((e.loaded / e.total) * 100), sent: false })
    }
    xhr.upload.onload = () => onProgress({ percent: 100, sent: true })
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText) as T)
      else reject(new Error(errorMessage(xhr.status, xhr.statusText, xhr.responseText)))
    }
    xhr.onerror = () => reject(new Error("Couldn't reach the server. Check your connection and try again."))
    xhr.send(form)
  })
}

export async function createTextPost(declaredTopic: string, text: string): Promise<{ post_id: string; status: string }> {
  const form = new FormData()
  form.set('kind', 'text')
  form.set('declared_topic', declaredTopic)
  form.set('text', text)
  return request('/posts', { method: 'POST', body: form })
}

export async function createVideoPost(
  declaredTopic: string,
  video: File,
  onProgress: (p: UploadProgress) => void,
): Promise<{ post_id: string; status: string }> {
  const form = new FormData()
  form.set('kind', 'video')
  form.set('declared_topic', declaredTopic)
  form.set('video', video)
  return uploadWithProgress('/posts', form, onProgress)
}

export async function getMyPosts(): Promise<Post[]> {
  return request('/posts')
}

export async function retryPost(postId: string): Promise<{ post_id: string; status: string }> {
  return request(`/posts/${postId}/retry`, { method: 'POST' })
}

export async function deletePost(postId: string): Promise<{ deleted: string }> {
  return request(`/posts/${postId}`, { method: 'DELETE' })
}

export async function getProfile(): Promise<{ avatar_url: string | null }> {
  return request('/profile')
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const form = new FormData()
  form.set('avatar', file)
  return request('/profile/avatar', { method: 'POST', body: form })
}

export interface FeedPage {
  posts: Post[]
  next_cursor: string | null // pass to getFeed() for the next page; null once there's nothing older
}

export async function getFeed(before?: string): Promise<FeedPage> {
  return request(before ? `/feed?before=${encodeURIComponent(before)}` : '/feed')
}

export interface PostStatusRow {
  id: string
  kind: PostKind
  declared_topic: string
  status: PostStatus
}

export async function getPostStatuses(ids: string[]): Promise<PostStatusRow[]> {
  return request(`/posts/status?ids=${ids.join(',')}`)
}

export async function likePost(postId: string): Promise<{ liked: boolean; like_count: number }> {
  return request(`/posts/${postId}/like`, { method: 'PUT' })
}

export async function unlikePost(postId: string): Promise<{ liked: boolean; like_count: number }> {
  return request(`/posts/${postId}/like`, { method: 'DELETE' })
}

export async function reportPost(postId: string, reason: string, note?: string): Promise<{ reported: boolean }> {
  return request(`/posts/${postId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, note }),
  })
}

export async function getComments(postId: string): Promise<Comment[]> {
  return request(`/posts/${postId}/comments`)
}

export async function addComment(postId: string, text: string): Promise<Comment> {
  return request(`/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export async function deleteComment(commentId: string): Promise<{ deleted: string }> {
  return request(`/comments/${commentId}`, { method: 'DELETE' })
}

export async function getInterests(): Promise<{ topics: string[] }> {
  return request('/interests')
}

export async function setInterests(topics: string[]): Promise<{ topics: string[] }> {
  return request('/interests', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics }),
  })
}
