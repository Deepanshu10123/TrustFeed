import { useCallback, useEffect, useState } from 'react'
import { getMyPosts, progressStreamUrl } from '../lib/api'
import type { Post } from '../lib/types'
import { previewFor, timeAgo } from '../lib/format'
import './MyPostsScreen.css'

const POLL_INTERVAL_MS = 4000

/** Milestone 7b: shows the live step text for one processing post via
 * Server-Sent Events. Falls back to a generic message until the first
 * event arrives, and fails silently to that same fallback if the stream
 * never connects -- the polling above is what actually catches the real
 * status change either way, this is purely the nice-to-have narration. */
function LiveProgress({ postId }: { postId: string }) {
  const [message, setMessage] = useState('Checking relevance and sources...')

  useEffect(() => {
    let source: EventSource | null = null
    let cancelled = false

    progressStreamUrl(postId).then((url) => {
      if (cancelled) return
      source = new EventSource(url)
      source.onmessage = (event) => setMessage(event.data)
      source.onerror = () => source?.close()
    })

    return () => {
      cancelled = true
      source?.close()
    }
  }, [postId])

  return <div className="status-sub">{message}</div>
}

export function MyPostsScreen({ refreshSignal }: { refreshSignal: number }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getMyPosts()
      .then(setPosts)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  // Poll while anything is still processing -- this is how the frontend
  // reliably learns a post finished (Milestone 5). The live SSE progress
  // above is a nice-to-have narration on top of this, not a replacement
  // for it -- if streaming fails, polling still catches the real change.
  useEffect(() => {
    const anyProcessing = posts?.some((p) => p.status === 'processing') ?? false
    if (!anyProcessing) return
    const id = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [posts, load])

  if (error) return <div className="panel-padding">Couldn't load your posts: {error}</div>
  if (posts === null) return <div className="panel-padding">Loading...</div>
  if (posts.length === 0) return <div className="panel-padding">You haven't posted anything yet.</div>

  return (
    <div className="panel-padding">
      {posts.map((post) => (
        <div className="mypost" key={post.id}>
          <div className="mypost-top">
            <span className="mypost-preview">{previewFor(post)}</span>
            {post.status === 'processing' && (
              <span className="status-badge processing">
                <span className="spin" />
                Processing
              </span>
            )}
            {post.status === 'published' && <span className="status-badge published">Published</span>}
            {post.status === 'rejected' && <span className="status-badge rejected">Rejected</span>}
            {post.status === 'needs_review' && <span className="status-badge review">Needs Review</span>}
            {post.status === 'failed' && <span className="status-badge failed">Failed</span>}
          </div>
          {post.status === 'processing' && <LiveProgress postId={post.id} />}
          {post.status === 'rejected' && <div className="status-sub">{post.rejection_reason}</div>}
          {post.status === 'needs_review' && (
            <div className="status-sub">{post.rejection_reason ?? 'This one is borderline -- a human needs to take a look before it can be shown.'}</div>
          )}
          {post.status === 'failed' && <div className="status-sub">Something went wrong processing this post.</div>}
          <div className="mypost-time">{timeAgo(post.created_at)}</div>
        </div>
      ))}
    </div>
  )
}
