import { useEffect, useRef, useState } from 'react'
import { addComment, deleteComment, getComments, getFeed } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import type { Comment, Post } from '../lib/types'
import { captionFor, handleForUser, summarizeVerdict, timeAgo, uploaderHandle } from '../lib/format'
import './FeedScreen.css'

const BADGE_CLASS: Record<string, string> = {
  'Well Supported': 'supported',
  'Mixed Evidence': 'mixed',
  'Unsupported': 'unsupported',
  'Unable to Verify': 'unable',
}

// A stable-but-varied background per post -- shown behind the real
// <video> while it loads, and as the only background for text posts.
function bgStyleFor(postId: string): React.CSSProperties {
  let hash = 0
  for (const ch of postId) hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return { background: `linear-gradient(160deg, oklch(46% 0.08 ${hash}), oklch(20% 0.06 ${(hash + 20) % 360}))` }
}

/** Plays only while its own slide is actually visible in the snap-scroll
 * feed -- otherwise every video in the feed would play at once. Starts
 * muted because browsers block autoplay-with-sound outright; `muted` is
 * set imperatively (not just as a JSX prop) since browsers don't reliably
 * react to that prop changing on an already-playing video. */
function VideoBackground({ src, muted }: { src: string; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.6 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [muted])

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

/** A comment thread for one post, opened over the whole feed as a bottom
 * sheet. No moderation beyond sign-in and "delete your own, or delete
 * anything on your own post" -- a real launch would need more than that,
 * same honest gap as post content itself (ADR 0002). */
function CommentsSheet({
  post,
  currentUserId,
  onClose,
}: {
  post: Post
  currentUserId: string | undefined
  onClose: () => void
}) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  function load() {
    getComments(post.id)
      .then(setComments)
      .catch((e) => setError(e.message))
  }

  useEffect(load, [post.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    const value = text.trim()
    if (!value) return
    setPosting(true)
    try {
      await addComment(post.id, value)
      setText('')
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(commentId)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const canModerateAll = currentUserId === post.user_id

  return (
    <div className="comments-overlay" onClick={onClose}>
      <div className="comments-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="comments-header">
          <span>Comments</span>
          <button className="comments-close" onClick={onClose} type="button" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="comments-list">
          {error && <div className="comment-empty">{error}</div>}
          {comments === null && !error && <div className="comment-empty">Loading...</div>}
          {comments?.length === 0 && <div className="comment-empty">No comments yet -- say something.</div>}
          {comments?.map((c) => (
            <div className="comment-row" key={c.id}>
              <span className="comment-avatar">U</span>
              <div className="comment-body">
                <div className="comment-meta">
                  <span className="comment-handle">{handleForUser(c.user_id)}</span>
                  <span className="comment-time">{timeAgo(c.created_at)}</span>
                </div>
                <div className="comment-text">{c.text}</div>
              </div>
              {(c.user_id === currentUserId || canModerateAll) && (
                <button className="comment-delete" onClick={() => handleDelete(c.id)} type="button">
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="comment-form">
          <input
            className="comment-input"
            placeholder="Add a comment..."
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button className="comment-send" onClick={handleSubmit} disabled={posting || !text.trim()} type="button">
            Post
          </button>
        </div>
      </div>
    </div>
  )
}

export function FeedScreen() {
  const { session } = useAuth()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Shared across all slides -- only one video plays at a time, and a
  // sound preference that persists as you swipe matches how every
  // short-form feed already behaves.
  const [muted, setMuted] = useState(true)
  const [commentsPost, setCommentsPost] = useState<Post | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    getFeed()
      .then(setPosts)
      .catch((e) => setError(e.message))
  }, [])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  // No per-post URLs exist yet (this app has no router -- see Milestone
  // 5's honest gap), so this shares a caption plus the app's general
  // link, not a deep link straight to this exact post.
  async function handleShare(post: Post) {
    const caption = post.kind === 'text' ? post.content : captionFor(post)
    const text = `${post.declared_topic}: "${caption.length > 100 ? `${caption.slice(0, 100)}...` : caption}" -- checked on TrustFeed`
    const url = window.location.origin

    if (navigator.share) {
      try {
        await navigator.share({ title: 'TrustFeed', text, url })
      } catch {
        // the user closed the share sheet without picking anything -- not an error
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      showToast('Link copied to clipboard')
    } catch {
      showToast("Couldn't copy the link")
    }
  }

  if (error) return <div className="feed-status">Couldn't load the feed: {error}</div>
  if (posts === null) return <div className="feed-status">Loading the feed...</div>
  if (posts.length === 0) return <div className="feed-status">No published posts yet. Be the first to upload one.</div>

  return (
    <>
    <div className="feed-scroll">
      {posts.map((post) => {
        const verdict = summarizeVerdict(post.report?.report?.verdicts ?? [])
        const badgeClass = verdict ? BADGE_CLASS[verdict.label] : 'unable'
        return (
          <div key={post.id} className="feed-slide" style={bgStyleFor(post.id)}>
            {post.kind === 'text' && <div className="slide-quote">&ldquo;{post.content}&rdquo;</div>}
            {post.kind === 'video' && post.video_url && <VideoBackground src={post.video_url} muted={muted} />}
            <div className="slide-scrim" />

            <div className="top-controls">
              <div className="pill-group">
                <button className="icon-pill" type="button" aria-label="Pause">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                </button>
                <button className="icon-pill" type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                  {muted ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z" /><line x1="16" y1="9" x2="21" y2="15" /><line x1="21" y1="9" x2="16" y2="15" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7" /><path d="M19 6a8.5 8.5 0 010 12" /></svg>
                  )}
                </button>
              </div>
              <button className="icon-pill wide" type="button" aria-label="More">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
              </button>
            </div>

            <div className="side-rail">
              <button className="rail-btn" type="button">
                <span className="circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.4-9.5-8.7C.8 8 2 4.5 5.2 4c2-.3 3.8.7 4.8 2.3C11 4.7 12.8 3.7 14.8 4c3.2.5 4.4 4 3.7 7.3C16 15.6 12 20 12 20z" /></svg>
                </span>
              </button>
              <button className="rail-btn" type="button" onClick={() => setCommentsPost(post)}>
                <span className="circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 01-8.9 8.4 9 9 0 01-3.6-.7L3 20l1-4.7A8.3 8.3 0 013.5 11 8.4 8.4 0 0112 3.1a8.5 8.5 0 019 8.4z" /></svg>
                </span>
              </button>
              <button className="rail-btn" type="button" onClick={() => handleShare(post)}>
                <span className="circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" /></svg>
                </span>
                <span className="count">Share</span>
              </button>
            </div>

            <div className="bottom-info">
              <div className="creator-row">
                <span className="avatar">{uploaderHandle(post).charAt(1).toUpperCase()}</span>
                <span className="handle">{uploaderHandle(post)}</span>
              </div>
              <span className="topic-chip">{post.declared_topic}</span>
              {post.kind === 'video' && <div className="caption">{captionFor(post)}</div>}
              <div className="verdict-row">
                <span className={`badge ${badgeClass}`}>{verdict?.label ?? 'No factual claims'}</span>
                <div className="verdict-explanation">
                  {verdict?.explanation ?? post.report?.report?.summary ?? ''}
                </div>
              </div>
              <div className="verdict-explanation">{timeAgo(post.created_at)}</div>
            </div>
          </div>
        )
      })}
    </div>
    {commentsPost && (
      <CommentsSheet post={commentsPost} currentUserId={session?.user.id} onClose={() => setCommentsPost(null)} />
    )}
    {toast && <div className="feed-toast">{toast}</div>}
    </>
  )
}
