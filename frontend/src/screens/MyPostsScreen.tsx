import { useCallback, useEffect, useRef, useState } from 'react'
import { deletePost, getMyPosts, getProfile, progressStreamUrl, uploadAvatar } from '../lib/api'
import type { Post, PostStatus } from '../lib/types'
import { previewFor, timeAgo } from '../lib/format'
import './MyPostsScreen.css'

const POLL_INTERVAL_MS = 4000

const STATUS_DOT: Record<PostStatus, string> = {
  processing: 'processing',
  published: 'published',
  rejected: 'rejected',
  needs_review: 'review',
  failed: 'failed',
  hidden: 'hidden',
}

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

/** A grid tile's video preview -- forcing currentTime forward a touch
 * once metadata loads makes the browser actually paint a real frame
 * instead of a blank black square, without needing canvas/CORS tricks. */
function VideoThumb({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  return (
    <video
      ref={ref}
      src={src}
      className="grid-thumb-video"
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={() => {
        if (ref.current) ref.current.currentTime = 0.1
      }}
    />
  )
}

function StatusBadge({ status }: { status: PostStatus }) {
  if (status === 'processing') {
    return (
      <span className="status-badge processing">
        <span className="spin" />
        Processing
      </span>
    )
  }
  if (status === 'published') return <span className="status-badge published">Published</span>
  if (status === 'rejected') return <span className="status-badge rejected">Rejected</span>
  if (status === 'needs_review') return <span className="status-badge review">Needs Review</span>
  if (status === 'hidden') return <span className="status-badge hidden">Hidden</span>
  return <span className="status-badge failed">Failed</span>
}

export function MyPostsScreen({ refreshSignal }: { refreshSignal: number }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [selected, setSelected] = useState<Post | null>(null)

  const load = useCallback(() => {
    getMyPosts()
      .then(setPosts)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  useEffect(() => {
    getProfile()
      .then((p) => setAvatarUrl(p.avatar_url))
      .catch(() => {}) // no profile row yet just means no avatar set -- not worth surfacing as an error
  }, [])

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

  // Keep an open detail sheet in sync with the underlying list (a status
  // flipping from processing to published while it's open, say) -- and
  // close it if the post it's showing was deleted out from under it.
  useEffect(() => {
    if (!selected || !posts) return
    const fresh = posts.find((p) => p.id === selected.id)
    setSelected(fresh ?? null)
  }, [posts]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const { avatar_url } = await uploadAvatar(file)
      setAvatarUrl(avatar_url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleDelete(postId: string) {
    if (!window.confirm('Delete this post? This removes it everywhere, including the shared feed.')) return
    setDeleteError(null)
    try {
      await deletePost(postId)
      load()
    } catch (e) {
      setDeleteError((e as Error).message)
    }
  }

  if (error) return <div className="panel-padding">Couldn't load your posts: {error}</div>
  if (posts === null) return <div className="panel-padding">Loading...</div>

  const publishedCount = posts.filter((p) => p.status === 'published').length

  return (
    <div className="profile-screen">
      <div className="profile-scroll">
        <div className="profile-header">
          <label className="profile-avatar">
            <input type="file" accept="image/*" onChange={handleAvatarChange} />
            {avatarUrl ? <img src={avatarUrl} alt="Your profile" /> : <span className="avatar-placeholder">+</span>}
            <span className="avatar-edit-badge">{uploadingAvatar ? 'Uploading...' : 'Edit'}</span>
          </label>
          <div className="profile-stats">
            <div className="stat">
              <strong>{posts.length}</strong>
              <span>Posts</span>
            </div>
            <div className="stat">
              <strong>{publishedCount}</strong>
              <span>Published</span>
            </div>
          </div>
        </div>

        {deleteError && <div className="status-sub delete-error">Couldn't delete that post: {deleteError}</div>}

        {posts.length === 0 ? (
          <div className="empty-note">You haven't posted anything yet.</div>
        ) : (
          <div className="profile-grid">
            {posts.map((post) => (
              <button key={post.id} className="grid-tile" onClick={() => setSelected(post)} type="button">
                {post.kind === 'video' && post.video_url ? (
                  <VideoThumb src={post.video_url} />
                ) : (
                  <div className="grid-tile-text">{post.content}</div>
                )}
                <span className={`grid-dot ${STATUS_DOT[post.status]}`} />
                {post.kind === 'video' && (
                  <svg className="grid-reel-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="14" height="14" rx="2" />
                    <path d="M17 9.5l4-2.5v10l-4-2.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="post-detail-overlay" onClick={() => setSelected(null)}>
          <div className="post-detail-sheet" onClick={(e) => e.stopPropagation()}>
            <button className="detail-close" onClick={() => setSelected(null)} type="button" aria-label="Close">
              &times;
            </button>
            <div className="mypost-top">
              <span className="mypost-preview">{previewFor(selected)}</span>
              <StatusBadge status={selected.status} />
            </div>
            {selected.status === 'processing' && <LiveProgress postId={selected.id} />}
            {selected.status === 'rejected' && <div className="status-sub">{selected.rejection_reason}</div>}
            {selected.status === 'needs_review' && (
              <div className="status-sub">
                {selected.rejection_reason ?? 'This one is borderline -- a human needs to take a look before it can be shown.'}
              </div>
            )}
            {selected.status === 'failed' && <div className="status-sub">Something went wrong processing this post.</div>}
            {selected.status === 'hidden' && (
              <div className="status-sub">Several people reported this post, so it's been taken out of the feed.</div>
            )}
            <div className="mypost-bottom">
              <span className="mypost-time">{timeAgo(selected.created_at)}</span>
              <button className="mypost-delete" onClick={() => handleDelete(selected.id)} type="button">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
