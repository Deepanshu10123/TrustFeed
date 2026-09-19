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
