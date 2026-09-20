import type { FeedUpdates } from './api'
import type { Post } from './types'

/** Puts fresh like and comment numbers onto the posts already on screen. Hands back
 * the very same list when nothing changed, so React doesn't redraw the feed (and
 * re-save it) for nothing. A post whose like is still being sent is left alone: the
 * server hasn't heard about it yet, so its number would flip the heart back. */
export function applyStats(posts: Post[] | null, stats: FeedUpdates['posts'], leaveAlone: ReadonlySet<string>): Post[] | null {
  if (!posts) return posts
  let changed = false
  const next = posts.map((post) => {
    const fresh = stats[post.id]
    if (!fresh || leaveAlone.has(post.id)) return post
    if (post.like_count === fresh.like_count && post.liked_by_me === fresh.liked_by_me && post.comment_count === fresh.comment_count) return post
    changed = true
    return { ...post, like_count: fresh.like_count, liked_by_me: fresh.liked_by_me, comment_count: fresh.comment_count }
  })
  return changed ? next : posts
}

/** One post's comment count set (as the open comments sheet finds out). Same list back if it already says so. */
export function withCommentCount(posts: Post[] | null, postId: string, count: number): Post[] | null {
  if (!posts || !posts.some((p) => p.id === postId && p.comment_count !== count)) return posts
  return posts.map((p) => (p.id === postId ? { ...p, comment_count: count } : p))
}
