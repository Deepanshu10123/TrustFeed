import { useEffect, useRef, useState } from 'react'
import { getPostStatuses, type PostStatusRow } from '../lib/api'

const POLL_INTERVAL_MS = 6000

/** Keeps an eye on posts that were just uploaded and says when each one has
 * been checked, wherever in the app the person has wandered off to. Only
 * watches while something is actually still being checked, and only posts
 * handed to `watch` this session. */
export function usePostWatcher(onFinished: (post: PostStatusRow) => void, enabled: boolean) {
  const [pending, setPending] = useState<string[]>([])
  const onFinishedRef = useRef(onFinished)
  const notified = useRef<Set<string>>(new Set())

  // Always the latest callback, without restarting the timer every render.
  useEffect(() => {
    onFinishedRef.current = onFinished
  })

  useEffect(() => {
    if (!enabled || pending.length === 0) return
    const timer = setInterval(async () => {
      try {
        const rows = await getPostStatuses(pending)
        const stillChecking = new Set(rows.filter((r) => r.status === 'processing').map((r) => r.id))
        // Anything no longer being checked is done with -- including a post
        // that was deleted meanwhile, which simply isn't in `rows` any more.
        const done = new Set(pending.filter((id) => !stillChecking.has(id)))
        if (done.size === 0) return
        // Only drop the ones this request knew about: something uploaded
        // while it was in flight must stay on the list.
        setPending((prev) => prev.filter((id) => !done.has(id)))
        for (const row of rows) {
          if (row.status !== 'processing' && !notified.current.has(row.id)) {
            notified.current.add(row.id)
            onFinishedRef.current(row)
          }
        }
      } catch {
        // the next tick tries again
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [pending, enabled])

  return { watch: (postId: string) => setPending((prev) => (prev.includes(postId) ? prev : [...prev, postId])) }
}
