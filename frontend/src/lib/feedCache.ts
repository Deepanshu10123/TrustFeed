import type { Post } from './types'

// A copy of the feed as you left it -- the posts loaded so far, how far you'd
// scrolled and which reel you were on -- so coming back from another tab
// reopens at the same reel instead of starting over. In memory only: a page
// reload is a fresh start.

export type FeedMode = 'all' | 'following'

// Video links stop working after an hour, so a copy older than this isn't
// worth going back to -- the feed starts fresh instead.
const MAX_AGE_MS = 30 * 60 * 1000

export interface SavedFeed {
  startedAt: number // when this feed was first loaded (not when it was last scrolled)
  mode: FeedMode
  posts: Post[]
  cursor: string | null // where the next page starts
  activeIndex: number
}

let saved: (SavedFeed & { userId: string }) | null = null

export function savedFeed(userId: string): SavedFeed | null {
  if (!saved || saved.userId !== userId || Date.now() - saved.startedAt > MAX_AGE_MS) return null
  return saved
}

export function saveFeed(userId: string, feed: SavedFeed): void {
  saved = { userId, ...feed }
}

/** For when something changed that the saved copy doesn't know about -- new
 * interests, a post you deleted -- so the feed should load again from the top. */
export function forgetSavedFeed(): void {
  saved = null
}
