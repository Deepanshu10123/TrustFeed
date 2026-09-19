// Share links look like  https://<the site>/?post=<post id>. There's no router
// in this app, so the id rides in the address bar; opening one shows that post
// first in the feed.

import { captionFor } from './format'
import type { Post } from './types'

const STORAGE_KEY = 'trustfeed:sharedPost'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Kept in memory too, in case the browser won't let us use sessionStorage.
let remembered: string | null = null

export function shareUrlFor(postId: string): string {
  return `${window.location.origin}/?post=${postId}`
}

/** Shares a short caption plus a link that opens this exact post -- the
 * phone's share sheet where there is one, otherwise it copies both to the
 * clipboard. Says which happened, so the caller can tell the person. */
export async function sharePost(post: Post): Promise<'shared' | 'copied' | 'failed'> {
  const caption = post.kind === 'text' ? post.content : captionFor(post)
  const text = `${post.declared_topic}: "${caption.length > 100 ? `${caption.slice(0, 100)}...` : caption}" -- checked on TrustFeed`
  const url = shareUrlFor(post.id)

  if (navigator.share) {
    try {
      await navigator.share({ title: 'TrustFeed', text, url })
    } catch {
      // the user closed the share sheet without picking anything -- not an error
    }
    return 'shared'
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** Picks up the post id from a shared link the person just opened. It has
 * to survive signing in -- with Google that means leaving the site and coming
 * back to a bare address -- so it's remembered for this visit, and the
 * address bar is tidied so a refresh doesn't keep re-opening it. */
export function takeSharedPostId(): string | null {
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get('post')
  if (fromUrl && UUID_PATTERN.test(fromUrl)) {
    remembered = fromUrl
    try {
      sessionStorage.setItem(STORAGE_KEY, fromUrl)
    } catch {
      // storage is unavailable -- the in-memory copy covers this page's life
    }
    url.searchParams.delete('post')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
  if (remembered) return remembered
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    return stored && UUID_PATTERN.test(stored) ? stored : null
  } catch {
    return null
  }
}

/** Once the post has been shown (or turned out not to exist any more). */
export function clearSharedPostId(): void {
  remembered = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing was stored
  }
}
