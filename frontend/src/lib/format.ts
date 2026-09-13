import type { Post, Verdict } from './types'

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Picks the single most-cautious verdict to summarize a post with more
 * than one claim -- "Unable to Verify" outranks "Mixed Evidence", which
 * outranks "Well Supported". (Published posts never contain an
 * "Unsupported" claim -- the gate would have rejected them.) */
export function summarizeVerdict(verdicts: Verdict[]): Verdict | null {
  if (verdicts.length === 0) return null
  const rank = { 'Unable to Verify': 0, 'Mixed Evidence': 1, 'Unsupported': 2, 'Well Supported': 3 }
  return [...verdicts].sort((a, b) => rank[a.label] - rank[b.label])[0]
}

export function handleForUser(userId: string): string {
  return `@user-${userId.slice(0, 6)}`
}

export function uploaderHandle(post: Post): string {
  return handleForUser(post.user_id)
}

export function captionFor(post: Post): string {
  if (post.kind === 'text') return post.content
  return post.report?.understanding?.transcript ?? '(video)'
}

export function previewFor(post: Post): string {
  const topic = post.declared_topic
  if (post.kind === 'video') return `${topic} · video post`
  const text = post.content.length > 60 ? `${post.content.slice(0, 60)}...` : post.content
  return `${topic} · "${text}"`
}
