import type { CSSProperties } from 'react'
import type { Post, Verdict, VerdictLabel } from './types'

const BADGE_CLASS: Record<VerdictLabel, string> = {
  'Well Supported': 'supported',
  'Mixed Evidence': 'mixed',
  'Unsupported': 'unsupported',
  'Unable to Verify': 'unable',
}

/** The CSS class that colors a verdict badge. A post with no factual
 * claims (no label) gets the neutral one. */
export function badgeClassFor(label: VerdictLabel | undefined): string {
  return label ? BADGE_CLASS[label] : 'unable'
}

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

/** A starting point for someone who hasn't picked a username yet: their
 * Google name (or the start of their email), boiled down to letters and
 * numbers. Empty if nothing usable comes out. */
export function suggestUsername(name?: string, email?: string): string {
  const cleaned = (name || email?.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
  return cleaned.length >= 3 ? cleaned : ''
}

/** How a person is shown: their chosen username, or -- until they pick one --
 * an anonymous handle made from part of their id. */
export function handleForUser(userId: string, username?: string | null): string {
  return username ? `@${username}` : `@user-${userId.slice(0, 6)}`
}

export function uploaderHandle(post: Post): string {
  return handleForUser(post.user_id, post.uploader_username)
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

// A stable-but-varied background per post -- shown behind the real
// <video> while it loads, and as the only background for text posts.
export function bgStyleFor(postId: string): CSSProperties {
  let hash = 0
  for (const ch of postId) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return { background: `linear-gradient(160deg, oklch(46% 0.08 ${hash}), oklch(20% 0.06 ${(hash + 20) % 360}))` }
}
