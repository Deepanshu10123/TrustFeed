import { useEffect, useRef, useState } from 'react'
import { addComment, deleteComment, getComments, getFeed, getSharedPost, likePost, unlikePost, type FeedPage } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import type { Comment, Post } from '../lib/types'
import { shareUrlFor } from '../lib/shareLink'
import { badgeClassFor, captionFor, handleForUser, summarizeVerdict, timeAgo, uploaderHandle } from '../lib/format'
import { EvidenceSheet } from './EvidenceSheet'
import { ReportSheet } from './ReportSheet'
import { UserProfileSheet } from './UserProfileSheet'
import { FeedSkeleton } from './Skeletons'
import './FeedScreen.css'

// A page can come back empty while there's still more to see -- when every
// post on it is one you've reported -- so keep going until something shows or
// there's nothing left.
async function fetchNonEmptyPage(before?: string): Promise<FeedPage> {
  let page = await getFeed(before)
  while (page.posts.length === 0 && page.next_cursor) page = await getFeed(page.next_cursor)
  return page
}

// What the feed opens with: the first page, and -- if someone opened a shared
// link -- that post put on top of it. A link to something that's gone (deleted,
// hidden after reports) just means the normal feed.
async function fetchFirstScreen(sharedPostId: string | null) {
  const [page, shared] = await Promise.all([
    fetchNonEmptyPage(),
    sharedPostId ? getSharedPost(sharedPostId).catch(() => null) : Promise.resolve(null),
  ])
  const posts = shared ? [shared, ...page.posts.filter((p) => p.id !== shared.id)] : page.posts
  return { posts, nextCursor: page.next_cursor, sharedMissing: sharedPostId !== null && shared === null }
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
 * react to that prop changing on an already-playing video. `paused` is the
 * viewer's own choice via the pause button -- it holds the video still even
 * while its slide is on screen. */
function VideoBackground({
  src,
  muted,
  paused,
  preload,
}: {
  src: string
  muted: boolean
  paused: boolean
  preload: 'auto' | 'metadata'
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const visibleRef = useRef(false)
  const pausedRef = useRef(paused)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
        if (entry.isIntersecting && !pausedRef.current) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.6 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    pausedRef.current = paused
    const video = ref.current
    if (!video) return
    if (paused) video.pause()
    else if (visibleRef.current) video.play().catch(() => {})
  }, [paused])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [muted])

  return (
    <video
      ref={ref}
      src={src}
      preload={preload}
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
  onOpenProfile,
}: {
  post: Post
  currentUserId: string | undefined
  onClose: () => void
  onOpenProfile: (userId: string) => void
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
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <span>Comments</span>
          <button className="sheet-close" onClick={onClose} type="button" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="sheet-list">
          {error && <div className="comment-empty">{error}</div>}
          {comments === null && !error && <div className="comment-empty">Loading...</div>}
          {comments?.length === 0 && <div className="comment-empty">No comments yet -- say something.</div>}
          {comments?.map((c) => (
            <div className="comment-row" key={c.id}>
              <span className="comment-avatar">{handleForUser(c.user_id, c.username).charAt(1).toUpperCase()}</span>
              <div className="comment-body">
                <div className="comment-meta">
                  <button className="comment-handle comment-link" type="button" onClick={() => onOpenProfile(c.user_id)}>
                    {handleForUser(c.user_id, c.username)}
                  </button>
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

export function FeedScreen({
  sharedPostId,
  onSharedHandled,
}: {
  sharedPostId: string | null
  onSharedHandled: () => void
}) {
  const { session } = useAuth()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Shared across all slides -- only one video plays at a time, and a
  // sound preference that persists as you swipe matches how every
  // short-form feed already behaves.
  const [muted, setMuted] = useState(true)
  const [commentsPost, setCommentsPost] = useState<Post | null>(null)
  const [evidencePost, setEvidencePost] = useState<Post | null>(null)
  const [reportingPost, setReportingPost] = useState<Post | null>(null)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [pausedIds, setPausedIds] = useState<Set<string>>(() => new Set())
  // Only one caption is open at a time -- opening another closes this one.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Posts with a like request still in flight, so a fast double-tap can't
  // send two requests that race each other.
  const pendingLikes = useRef<Set<string>>(new Set())

  // Which slide is on screen, so only the videos next to it are loaded --
  // without this the feed starts fetching all 50 at once.
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  // The first load after the server has been asleep can take up to a minute;
  // after a few seconds the placeholder says so instead of just sitting there.
  const [slow, setSlow] = useState(false)

  // Where the next page starts (null once there's nothing older).
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const loadingMoreRef = useRef(false)
  const loadMoreRef = useRef<() => void>(() => {})

  // Runs once, when the feed opens -- `sharedPostId` is only ever the link the
  // app was opened with, and it's cleared as soon as it's been used.
  useEffect(() => {
    fetchFirstScreen(sharedPostId)
      .then(({ posts, nextCursor, sharedMissing }) => {
        setPosts(posts)
        setCursor(nextCursor)
        if (sharedPostId) onSharedHandled()
        if (sharedMissing) showToast("That post isn't available any more.")
      })
      .catch((e) => setError(e.message))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (posts !== null || error) return
    const timer = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(timer)
  }, [posts, error])

  const postCount = posts?.length ?? 0
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = Number((entry.target as HTMLElement).dataset.index)
          setActiveIndex(index)
          // Getting close to the last post: fetch the next page now, so it's
          // ready before you reach the end. (It does nothing if there's no
          // next page or one is already on its way.)
          if (index >= postCount - 3) loadMoreRef.current()
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('.feed-slide').forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [postCount])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  // The server keeps a post you've reported out of your feed from now on;
  // this just takes it off the screen straight away.
  function handleReported(postId: string) {
    setReportingPost(null)
    setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? prev)
    showToast("Thanks for reporting. It's off your feed now.")
  }

  function scrollToSlide(index: number) {
    scrollRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'start' })
  }

  // Tapping a post on someone's profile: jump to it if it's already in the
  // feed, otherwise put it on top (as a shared link does) and go there.
  async function openPostFromProfile(postId: string) {
    setProfileUserId(null)
    const at = posts?.findIndex((p) => p.id === postId) ?? -1
    if (at >= 0) {
      scrollToSlide(at)
      return
    }
    try {
      const post = await getSharedPost(postId)
      setPosts((prev) => [post, ...(prev ?? []).filter((p) => p.id !== post.id)])
      setActiveIndex(0)
      setTimeout(() => scrollToSlide(0), 0)
    } catch {
      showToast("That post isn't available any more.")
    }
  }

  async function loadMore() {
    if (!cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    try {
      const page = await fetchNonEmptyPage(cursor)
      setPosts((prev) => {
        const seen = new Set((prev ?? []).map((p) => p.id))
        return [...(prev ?? []), ...page.posts.filter((p) => !seen.has(p.id))]
      })
      setCursor(page.next_cursor)
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
      showToast("Couldn't load more posts")
    } finally {
      loadingMoreRef.current = false
    }
  }

  // The scroll observer above calls this through a ref, so it always gets the
  // latest version. A failed attempt isn't retried until you scroll again (or
  // press "Load more").
  useEffect(() => {
    loadMoreRef.current = loadMore
  })

  function togglePause(postId: string) {
    setPausedIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  function setLikeState(postId: string, liked: boolean, count: number) {
    setPosts((prev) => prev?.map((p) => (p.id === postId ? { ...p, liked_by_me: liked, like_count: count } : p)) ?? prev)
  }

  // Updates the heart and count immediately, then reconciles with what the
  // server says (its count is the real one -- other people may have liked
  // in the meantime) or puts things back if the request failed.
  async function toggleLike(post: Post) {
    if (pendingLikes.current.has(post.id)) return
    pendingLikes.current.add(post.id)

    const wasLiked = post.liked_by_me ?? false
    const before = post.like_count ?? 0
    setLikeState(post.id, !wasLiked, Math.max(0, before + (wasLiked ? -1 : 1)))
    try {
      const result = await (wasLiked ? unlikePost(post.id) : likePost(post.id))
      setLikeState(post.id, result.liked, result.like_count)
    } catch {
      setLikeState(post.id, wasLiked, before)
      showToast("Couldn't update your like")
    } finally {
      pendingLikes.current.delete(post.id)
    }
  }

  // Shares a short caption plus a link that opens this exact post (see
  // lib/shareLink.ts) -- the phone's share sheet where there is one, otherwise
  // it copies both to the clipboard.
  async function handleShare(post: Post) {
    const caption = post.kind === 'text' ? post.content : captionFor(post)
    const text = `${post.declared_topic}: "${caption.length > 100 ? `${caption.slice(0, 100)}...` : caption}" -- checked on TrustFeed`
    const url = shareUrlFor(post.id)

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
  if (posts === null) return <FeedSkeleton slow={slow} />
  if (posts.length === 0) return <div className="feed-status">No published posts yet. Be the first to upload one.</div>

  return (
    <>
    <div className="feed-scroll" ref={scrollRef}>
      {posts.map((post, index) => {
        const verdict = summarizeVerdict(post.report?.report?.verdicts ?? [])
        const badgeClass = badgeClassFor(verdict?.label)
        // What the collapsed caption shows: the video's transcript, or for a
        // text post (whose text is already the big quote) the verdict's
        // explanation. Opening it reveals everything.
        const caption = post.kind === 'video' ? captionFor(post) : ''
        const explanation = verdict?.explanation ?? post.report?.report?.summary ?? ''
        const preview = caption || explanation
        const hasMore = (caption !== '' && explanation !== '') || preview.length > 60
        const expanded = expandedId === post.id
        const paused = pausedIds.has(post.id)
        const liked = post.liked_by_me ?? false
        const isMine = post.user_id === session?.user.id
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
                {post.kind === 'video' && (
                  <button className="icon-pill" type="button" aria-label={paused ? 'Play' : 'Pause'} onClick={() => togglePause(post.id)}>
                    {paused ? (
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    )}
                  </button>
                )}
                <button className="icon-pill" type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                  {muted ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z" /><line x1="16" y1="9" x2="21" y2="15" /><line x1="21" y1="9" x2="16" y2="15" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 5V4L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7" /><path d="M19 6a8.5 8.5 0 010 12" /></svg>
                  )}
                </button>
              </div>
              {!isMine && (
                <button className="icon-pill wide" type="button" aria-label="Report this post" onClick={() => setReportingPost(post)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                </button>
              )}
            </div>

            <div className="side-rail">
              <button
                className={`rail-btn${liked ? ' liked' : ''}`}
                type="button"
                aria-pressed={liked}
                aria-label={liked ? 'Unlike' : 'Like'}
                onClick={() => toggleLike(post)}
              >
                <span className="circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20s-7-4.4-9.5-8.7C.8 8 2 4.5 5.2 4c2-.3 3.8.7 4.8 2.3C11 4.7 12.8 3.7 14.8 4c3.2.5 4.4 4 3.7 7.3C16 15.6 12 20 12 20z" /></svg>
                </span>
                <span className="count">{post.like_count ?? 0}</span>
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
                <button className="creator-link" type="button" onClick={() => setProfileUserId(post.user_id)}>
                <span className="avatar">
                  {post.uploader_avatar_url ? (
                    <img src={post.uploader_avatar_url} alt="" />
                  ) : (
                    uploaderHandle(post).charAt(1).toUpperCase()
                  )}
                </span>
                <span className="handle">{uploaderHandle(post)}</span>
                </button>
                <span className="posted-ago">{timeAgo(post.created_at)}</span>
              </div>
              <div className="tag-row">
                <span className="topic-chip">{post.declared_topic}</span>
                <button
                  className={`badge ${badgeClass}`}
                  type="button"
                  aria-label="See how this was checked"
                  onClick={() => setEvidencePost(post)}
                >
                  {verdict?.label ?? 'No factual claims'}
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </div>
              {expanded ? (
                <div className="post-text">
                  {caption && <div className="caption">{caption}</div>}
                  {explanation && <div className="verdict-explanation">{explanation}</div>}
                  <button className="more-btn" type="button" onClick={() => setExpandedId(null)}>
                    less
                  </button>
                </div>
              ) : hasMore ? (
                <button className="post-text-btn" type="button" onClick={() => setExpandedId(post.id)}>
                  <span className="caption clamped">{preview}</span>
                  <span className="more-btn">more</span>
                </button>
              ) : (
                preview && <div className="caption">{preview}</div>
              )}
            </div>
          </div>
        )
      })}
      <div className="feed-slide feed-end" data-index={posts.length}>
        {!cursor ? (
          <>
            <p className="feed-end-title">You're all caught up</p>
            <p className="feed-end-sub">New posts show up here first.</p>
          </>
        ) : loadFailed ? (
          <button
            className="feed-end-btn"
            type="button"
            onClick={() => {
              setLoadFailed(false)
              loadMore()
            }}
          >
            Load more
          </button>
        ) : (
          <p className="feed-end-title">Loading more...</p>
        )}
      </div>
    </div>
    {commentsPost && (
      <CommentsSheet
        post={commentsPost}
        currentUserId={session?.user.id}
        onClose={() => setCommentsPost(null)}
        onOpenProfile={(userId) => {
          setCommentsPost(null)
          setProfileUserId(userId)
        }}
      />
    )}
    {profileUserId && (
      <UserProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} onOpenPost={openPostFromProfile} />
    )}
    {evidencePost && <EvidenceSheet post={evidencePost} onClose={() => setEvidencePost(null)} />}
    {reportingPost && (
      <ReportSheet post={reportingPost} onClose={() => setReportingPost(null)} onReported={handleReported} />
    )}
    {toast && <div className="feed-toast">{toast}</div>}
    </>
  )
}
