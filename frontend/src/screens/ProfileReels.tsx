import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { bgStyleFor, timeAgo } from '../lib/format'
import { sharePost } from '../lib/shareLink'
import type { Post } from '../lib/types'
import { CommentsSheet } from './CommentsSheet'
import { EvidenceSheet } from './EvidenceSheet'
import { ReelCaption } from './ReelCaption'
import { BackIcon, CommentIcon, MutedIcon, PauseIcon, PlayIcon, ShareIcon, SoundIcon, TrashIcon } from './ReelIcons'
import { VideoBackground } from './VideoBackground'
import './ProfileReels.css'

/** Your own posted reels, one after another: tap one in your profile grid and
 * it opens here, playing, and you swipe up and down through the rest -- like
 * Instagram. It covers the grid the way a panel would, so closing it puts you
 * back exactly where you were. Only published posts are here; ones still being
 * checked, rejected or failed keep their status panel instead. The reels
 * themselves are drawn with the feed's styles. */
export function ProfileReels({
  posts,
  startId,
  currentUserId,
  onClose,
  onDelete,
}: {
  posts: Post[] // all of your posts -- the published ones are shown
  startId: string
  currentUserId: string
  onClose: () => void
  onDelete: (postId: string) => Promise<string | null> // asks first, then deletes; says why if it couldn't
}) {
  // The order is fixed when it opens, so a post finishing its check while you're
  // watching can't slide in and shift what's under your thumb. After that only
  // the details are kept up to date, and a reel that's gone (deleted, or hidden
  // after reports) drops out.
  const [order] = useState(() => posts.filter((p) => p.status === 'published').map((p) => p.id))
  const latest = new Map(posts.map((p) => [p.id, p]))
  const reels = order.map((id) => latest.get(id)).filter((p): p is Post => p !== undefined && p.status === 'published')

  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, order.indexOf(startId)))
  const scrollRef = useRef<HTMLDivElement>(null)
  const [muted, setMuted] = useState(true)
  const [pausedIds, setPausedIds] = useState<Set<string>>(() => new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [commentsPost, setCommentsPost] = useState<Post | null>(null)
  const [evidencePost, setEvidencePost] = useState<Post | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Open on the reel that was tapped, before the first paint.
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (root) root.scrollTop = activeIndex * root.clientHeight
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Which reel is on screen, so only the videos next to it are loaded.
  const reelCount = reels.length
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveIndex(Number((entry.target as HTMLElement).dataset.index))
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('.feed-slide').forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [reelCount])

  // Nothing left to show (the last reel was deleted) -- back to the grid.
  useEffect(() => {
    if (reelCount === 0) onClose()
  }, [reelCount, onClose])

  // Escape closes it, unless a panel is open on top.
  const panelOpen = commentsPost !== null || evidencePost !== null
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !panelOpen) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panelOpen, onClose])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  async function handleShare(post: Post) {
    const result = await sharePost(post)
    if (result === 'copied') showToast('Link copied to clipboard')
    else if (result === 'failed') showToast("Couldn't copy the link")
  }

  async function handleDelete(postId: string) {
    const failure = await onDelete(postId)
    if (failure) showToast(`Couldn't delete that post: ${failure}`)
  }

  function togglePause(postId: string) {
    setPausedIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  return (
    <div className="reels-overlay">
      <div className="feed-scroll" ref={scrollRef}>
        {reels.map((post, index) => {
          const expanded = expandedId === post.id
          const paused = pausedIds.has(post.id)
          return (
            <div
              key={post.id}
              data-index={index}
              className={`feed-slide${expanded ? ' expanded' : ''}`}
              style={bgStyleFor(post.id)}
            >
              {post.kind === 'text' && <div className="slide-quote">&ldquo;{post.content}&rdquo;</div>}
              {post.kind === 'video' && post.video_url && Math.abs(index - activeIndex) <= 1 && (
                <VideoBackground
                  src={post.video_url}
                  muted={muted}
                  paused={paused}
                  preload={index === activeIndex || index === activeIndex + 1 ? 'auto' : 'metadata'}
                />
              )}
              <div className="slide-scrim" />

              <div className="top-controls">
                <div className="pill-group">
                  <button className="icon-pill" type="button" aria-label="Back to your profile" onClick={onClose}>
                    <BackIcon />
                  </button>
                  {post.kind === 'video' && (
                    <button className="icon-pill" type="button" aria-label={paused ? 'Play' : 'Pause'} onClick={() => togglePause(post.id)}>
                      {paused ? <PlayIcon /> : <PauseIcon />}
                    </button>
                  )}
                  <button className="icon-pill" type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                    {muted ? <MutedIcon /> : <SoundIcon />}
                  </button>
                </div>
                <button className="icon-pill" type="button" aria-label="Delete this post" onClick={() => handleDelete(post.id)}>
                  <TrashIcon />
                </button>
              </div>

              <div className="side-rail">
                <button className="rail-btn" type="button" aria-label="Comments" onClick={() => setCommentsPost(post)}>
                  <span className="circle">
                    <CommentIcon />
                  </span>
                </button>
                <button className="rail-btn" type="button" aria-label="Share" onClick={() => handleShare(post)}>
                  <span className="circle">
                    <ShareIcon />
                  </span>
                  <span className="count">Share</span>
                </button>
              </div>

              <div className="bottom-info">
                <div className="creator-row">
                  <span className="posted-ago">{timeAgo(post.created_at)}</span>
                </div>
                <ReelCaption
                  post={post}
                  expanded={expanded}
                  onExpandedChange={(open) => setExpandedId(open ? post.id : null)}
                  onOpenEvidence={setEvidencePost}
                />
              </div>
            </div>
          )
        })}
      </div>

      {commentsPost && <CommentsSheet post={commentsPost} currentUserId={currentUserId} onClose={() => setCommentsPost(null)} />}
      {evidencePost && <EvidenceSheet post={evidencePost} onClose={() => setEvidencePost(null)} />}
      {toast && <div className="feed-toast">{toast}</div>}
    </div>
  )
}
