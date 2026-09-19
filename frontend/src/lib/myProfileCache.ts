import { getMyPosts, getProfile } from './api'
import type { Post } from './types'

// A copy of what the My Posts screen last showed, kept in memory so coming
// back to it opens with content instead of a loading screen. The screen still
// asks the server for fresh data every time and swaps it in quietly -- this is
// only what to show until that arrives. It's gone when the page is reloaded.

export interface MyProfileCopy {
  posts: Post[]
  avatarUrl: string | null
  username: string | null
  followerCount: number | null
  followingCount: number | null
}

let saved: { userId: string; refreshSignal: number; copy: MyProfileCopy } | null = null

/** The last copy for this person -- but only if nothing has happened since
 * that would make it wrong (a new upload, a post finishing while you were
 * elsewhere), which is what a changed `refreshSignal` means. */
export function savedProfile(userId: string, refreshSignal: number): MyProfileCopy | null {
  return saved && saved.userId === userId && saved.refreshSignal === refreshSignal ? saved.copy : null
}

export function saveProfile(userId: string, refreshSignal: number, copy: MyProfileCopy): void {
  saved = { userId, refreshSignal, copy }
}

/** A head start: once the feed is up, fetch what My Posts needs and save it,
 * so even the first visit opens instantly. It only saves if both requests
 * worked (half a profile would flash into place) and the screen hasn't saved
 * something itself in the meantime. If anything goes wrong nothing is lost --
 * the screen just loads it itself, as before. */
export async function prefetchMyProfile(userId: string, refreshSignal: number): Promise<void> {
  if (savedProfile(userId, refreshSignal)) return
  try {
    const [posts, profile] = await Promise.all([getMyPosts(), getProfile()])
    if (savedProfile(userId, refreshSignal)) return
    saveProfile(userId, refreshSignal, {
      posts,
      avatarUrl: profile.avatar_url,
      username: profile.username,
      followerCount: profile.follower_count ?? null, // `?? null`: the site can briefly be newer than the server
      followingCount: profile.following_count ?? null,
    })
  } catch {
    // only a head start
  }
}
