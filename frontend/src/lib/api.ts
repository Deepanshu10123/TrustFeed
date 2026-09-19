/**
 * Thin wrapper around the FastAPI backend. Every call attaches the
 * current Supabase session's access token -- our API never issues its
 * own tokens, it only ever verifies the one Supabase already gave us.
 */
import { supabase } from './supabase'
import type { Comment, Post } from './types'

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await authHeader()), ...(init?.headers ?? {}) }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${body}`)
  }
  return response.json()
}

export async function createTextPost(declaredTopic: string, text: string): Promise<{ post_id: string; status: string }> {
  const form = new FormData()
  form.set('kind', 'text')
  form.set('declared_topic', declaredTopic)
  form.set('text', text)
  return request('/posts', { method: 'POST', body: form })
}

export async function createVideoPost(declaredTopic: string, video: File): Promise<{ post_id: string; status: string }> {
  const form = new FormData()
  form.set('kind', 'video')
  form.set('declared_topic', declaredTopic)
  form.set('video', video)
  return request('/posts', { method: 'POST', body: form })
}

export async function getMyPosts(): Promise<Post[]> {
  return request('/posts')
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

export async function getFeed(): Promise<Post[]> {
  return request('/feed')
}

export async function likePost(postId: string): Promise<{ liked: boolean; like_count: number }> {
  return request(`/posts/${postId}/like`, { method: 'PUT' })
}

export async function unlikePost(postId: string): Promise<{ liked: boolean; like_count: number }> {
  return request(`/posts/${postId}/like`, { method: 'DELETE' })
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
