import { useState } from 'react'

/** Which reels have loaded enough to play through. The screens use it to hold
 * back the *next* reel's download until the one being watched is ready, so the
 * two don't compete for a slow connection. */
export function useReadyReels() {
  const [ready, setReady] = useState<Set<string>>(() => new Set())
  return {
    isReady: (postId: string) => ready.has(postId),
    markReady: (postId: string) => setReady((prev) => (prev.has(postId) ? prev : new Set(prev).add(postId))),
  }
}
