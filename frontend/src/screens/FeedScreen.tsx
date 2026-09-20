import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getFeed, getFeedUpdates, getSharedPost, likePost, retrying, unlikePost, type FeedPage } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useReadyReels } from '../hooks/useReadyReels'
import type { Post } from '../lib/types'
import { forgetSavedFeed, savedFeed, saveFeed, type FeedMode } from '../lib/feedCache'
import { applyStats, withCommentCount } from '../lib/feedUpdates'
import { sharePost } from '../lib/shareLink'
import { bgStyleFor, preloadFor, timeAgo, uploaderHandle } from '../lib/format'
import { CommentsSheet } from './CommentsSheet'
import { EvidenceSheet } from './EvidenceSheet'
import { ReelCaption } from './ReelCaption'
import { CommentIcon, MutedIcon, PauseIcon, PlayIcon, ShareIcon, SoundIcon } from './ReelIcons'
import { ReportSheet } from './ReportSheet'
import { UserProfileSheet } from './UserProfileSheet'
import { FeedSkeleton } from './Skeletons'
import { VideoBackground } from './VideoBackground'
import './FeedScreen.css'

// A page can come back empty while there's still more to see -- when every
// post on it is one you've reported -- so keep going until something shows or
// there's nothing left.
async function fetchNonEmptyPage(before?: string, following = false): Promise<FeedPage> {
  let page = await getFeed(before, following)
  while (page.posts.length === 0 && page.next_cursor) page = await getFeed(page.next_cursor, following)
  return page
}

// What the feed opens with: the first page, and -- if someone opened a shared
// link -- that post put on top of it. A link to something that's gone (deleted,
// hidden after reports) just means the normal feed.
async function fetchFirstScreen(sharedPostId: string | null, following: boolean) {
  const [page, shared] = await Promise.all([
    fetchNonEmptyPage(undefined, following),
    sharedPostId ? getSharedPost(sharedPostId).catch(() => null) : Promise.resolve(null),
  ])
  const posts = shared ? [shared, ...page.posts.filter((p) => p.id !== shared.id)] : page.posts
  return { posts, nextCursor: page.next_cursor, sharedMissing: sharedPostId !== null && shared === null }
}

// How often an open feed asks the server what has changed -- new reels, likes,
// comments. Also asked right away whenever you come back to the app. Nothing is asked
// while the app is hidden, and never twice within MIN_CHECK_GAP_MS.
const CHECK_EVERY_MS = 20_000
const MIN_CHECK_GAP_MS = 5_000
const MAX_CHECKED_POSTS = 60 // the server looks at no more than this many

/** "For you" (everyone, filtered by your interests) or "Following" (only the
 * people you follow), floating over the top of the feed. */
function FeedTabs({ mode, onChange }: { mode: FeedMode; onChange: (mode: FeedMode) => void }) {
  return (
    <div className="feed-tabs" role="tablist">
      <button className={mode === 'all' ? 'active' : ''} role="tab" aria-selected={mode === 'all'} type="button" onClick={() => onChange('all')}>
        For you
      </button>
      <button className={mode === 'following' ? 'active' : ''} role="tab" aria-selected={mode === 'following'} type="button" onClick={() => onChange('following')}>
        Following
      </button>
    </div>
  )
}

export function FeedScreen({
  userId,
  sharedPostId,
  onSharedHandled,
  onFirstLoad,
}: {
  userId: string
  sharedPostId: string | null
  onSharedHandled: () => void
  // Called when a fresh first screen has arrived -- the server is awake and the
  // feed is showing, so it's a good moment to fetch other things quietly.
  onFirstLoad?: () => void
}) {
  const { session } = useAuth()
  // Coming back from another tab: the feed as it was left, so it reopens at the
  // same reel. A shared link always wins -- that post has to be shown first.
  const [restored] = useState(() => (sharedPostId ? null : savedFeed(userId)))
  const [posts, setPosts] = useState<Post[] | null>(restored?.posts ?? null)
  const feedStartedAt = useRef(restored?.startedAt ?? Date.now())
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
  const [activeIndex, setActiveIndex] = useState(restored ? Math.min(restored.activeIndex, restored.posts.length) : 0)
  // How many times the posts have been laid end to end. Once there is nothing older
  // left to load, the feed doesn't stop: it goes round again, so there is always
  // another reel to swipe to (like every other short-video app).
  const [loops, setLoops] = useState(1)
  const lastGrownAt = useRef(0) // the slide count a round was last added at, so one scroll adds only one
  const scrollRef = useRef<HTMLDivElement>(null)
  // The first load after the server has been asleep can take up to a minute;
  // after a few seconds the placeholder says so instead of just sitting there.
  const [slow, setSlow] = useState(false)
  // Still nothing after half a minute: offer a way to try again by hand.
  const [stuck, setStuck] = useState(false)
  // Bumped by "Try again" to run the first load once more.
  const [attempt, setAttempt] = useState(0)
  const { isReady, markReady } = useReadyReels()

  // Where the next page starts (null once there's nothing older).
  const [cursor, setCursor] = useState<string | null>(restored?.cursor ?? null)
  const cursorRef = useRef(cursor)
  useEffect(() => {
    cursorRef.current = cursor
  })
  const [loadFailed, setLoadFailed] = useState(false)
  const loadingMoreRef = useRef(false)
  const loadMoreRef = useRef<() => void>(() => {})

  const [mode, setMode] = useState<FeedMode>(restored?.mode ?? 'all')
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  })

  // Keeping the feed up to date while it's open. `newCount` is how many reels have
  // appeared since it was loaded (shown as a "N new reels" button -- they're not slotted
  // in by themselves, because that would shift what's under your thumb).
  const [newCount, setNewCount] = useState(0)
  const postsRef = useRef(posts)
  useEffect(() => {
    postsRef.current = posts
  })
  const checkingRef = useRef(false)
  const lastCheckAt = useRef(0)
  const catchUpOnOpen = useRef(restored !== null) // a saved copy can be minutes old: catch up at once
  // Bumped whenever the feed is replaced, so a page of older posts that was still on its
  // way from before can't be tacked onto the new one.
  const feedVersion = useRef(0)

  // Loads the first screen when the feed opens, and again each time you switch
  // between "For you" and "Following". `sharedPostId` is only ever the link the
  // app was opened with (cleared as soon as it's been used) and only applies
  // to "For you". Nothing to load when the feed was restored from a saved copy.
  // A server that's still waking up (or a dropped connection) is retried by
  // itself, so the first visit after a quiet spell doesn't need a page reload.
  useEffect(() => {
    if (posts !== null) return
    let cancelled = false
    const sharedForThisFeed = mode === 'all' ? sharedPostId : null
    retrying(() => fetchFirstScreen(sharedForThisFeed, mode === 'following'), { cancelled: () => cancelled })
      .then(({ posts, nextCursor, sharedMissing }) => {
        if (cancelled) return
        feedStartedAt.current = Date.now()
        setPosts(posts)
        setCursor(nextCursor)
        if (sharedForThisFeed) onSharedHandled()
        if (sharedMissing) showToast("That post isn't available any more.")
        onFirstLoad?.()
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [mode, attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (posts !== null || error) return
    const slowTimer = setTimeout(() => setSlow(true), 6000)
    const stuckTimer = setTimeout(() => setStuck(true), 30000)
    return () => {
      clearTimeout(slowTimer)
      clearTimeout(stuckTimer)
    }
  }, [posts, error, attempt])

  // Back at the reel you left: jump straight to it, before the first paint, so
  // there's no flash of the top of the feed.
  useLayoutEffect(() => {
    if (restored && restored.activeIndex > 0) scrollToSlide(Math.min(restored.activeIndex, restored.posts.length))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Going to a slide that only exists after the next redraw (a reloaded feed, a post
  // put on top): wait for that redraw, rather than guessing with a timer that can
  // fire too early and leave you where you were.
  const scrollAfterRender = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (scrollAfterRender.current === null) return
    scrollToSlide(scrollAfterRender.current)
    scrollAfterRender.current = null
  })

  // Keep the saved copy in step with what's on screen (an empty feed isn't
  // worth going back to -- and it may just have had its last post reported).
  useEffect(() => {
    if (posts === null) return
    if (posts.length === 0) forgetSavedFeed()
    // Saved as a place in the posts themselves, not in the repeated rounds below.
    else saveFeed(userId, { startedAt: feedStartedAt.current, mode, posts, cursor, activeIndex: activeIndex % posts.length })
  }, [userId, mode, posts, cursor, activeIndex])

  const postCount = posts?.length ?? 0
  const slideCount = postCount * loops
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = Number((entry.target as HTMLElement).dataset.index)
          setActiveIndex(index)
          // Getting close to the last slide: make sure there's more ahead, so it's
          // there before you reach the end.
          if (index >= slideCount - 3) {
            if (cursorRef.current) {
              loadMoreRef.current() // an older page to fetch (does nothing if one is already on its way)
            } else if (postCount > 0 && lastGrownAt.current !== slideCount) {
              lastGrownAt.current = slideCount // nothing older left: go round again
              setLoops((n) => n + 1)
            }
          }
        }
      },
      { root, threshold: 0.6 },
    )
    root.querySelectorAll('.feed-slide').forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [slideCount, postCount])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2200)
  }

  // Asks the server what has changed in this feed and applies it: fresh like and comment
  // numbers go straight onto the reels, and new reels just raise the button. A failed
  // check is ignored -- the next one tries again.
  async function checkForUpdates() {
    const current = postsRef.current
    if (!current || current.length === 0 || checkingRef.current) return
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastCheckAt.current < MIN_CHECK_GAP_MS) return
    checkingRef.current = true
    lastCheckAt.current = Date.now()
    const startedIn = modeRef.current
    const version = feedVersion.current
    try {
      const newest = current.reduce((max, p) => (p.created_at > max ? p.created_at : max), current[0].created_at)
      const ids = current.slice(0, MAX_CHECKED_POSTS).map((p) => p.id)
      const updates = await getFeedUpdates(ids, newest, startedIn === 'following')
      if (modeRef.current !== startedIn || feedVersion.current !== version) return // the feed was replaced meanwhile
      setPosts((prev) => applyStats(prev, updates.posts, pendingLikes.current))
      setNewCount(updates.new_count)
    } catch {
      // ignored on purpose (see above)
    } finally {
      checkingRef.current = false
    }
  }
  const checkForUpdatesRef = useRef(checkForUpdates)
  useEffect(() => {
    checkForUpdatesRef.current = checkForUpdates
  })

  const loaded = posts !== null
  useEffect(() => {
    if (!loaded) return
    const timer = setInterval(() => checkForUpdatesRef.current(), CHECK_EVERY_MS)
    const backInView = () => {
      if (document.visibilityState === 'visible') checkForUpdatesRef.current()
    }
    document.addEventListener('visibilitychange', backInView)
    window.addEventListener('focus', backInView)
    if (catchUpOnOpen.current) {
      catchUpOnOpen.current = false
      checkForUpdatesRef.current()
    }
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', backInView)
      window.removeEventListener('focus', backInView)
    }
  }, [loaded, mode])

  // The "N new reels" button: load the feed again from the top and go there.
  async function showNewReels() {
    const waiting = newCount
    const startedIn = mode
    setNewCount(0)
    try {
      const first = await fetchFirstScreen(null, mode === 'following')
      if (modeRef.current !== startedIn) return
      feedVersion.current += 1
      feedStartedAt.current = Date.now()
      setPosts(first.posts)
      setCursor(first.nextCursor)
      setLoops(1)
      lastGrownAt.current = 0
      setActiveIndex(0)
      setExpandedId(null)
      scrollAfterRender.current = 0
    } catch {
      setNewCount(waiting)
      showToast("Couldn't load the new reels")
    }
  }

  // The server keeps a post you've reported out of your feed from now on;
  // this just takes it off the screen straight away.
  function handleReported(postId: string) {
    setReportingPost(null)
    const at = posts?.findIndex((p) => p.id === postId) ?? -1
    setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? prev)
    if (loops > 1 && at >= 0) {
      // The rounds were laid out for the old list, so start over at the post that
      // followed the reported one -- otherwise you'd land on something random.
      setLoops(1)
      lastGrownAt.current = 0
      setActiveIndex(at)
      scrollAfterRender.current = at
    }
    showToast("Thanks for reporting. It's off your feed now.")
  }

  function changeMode(next: FeedMode) {
    if (next === mode) return
    setMode(next)
    // Start the other feed again from the top.
    setPosts(null)
    setCursor(null)
    setError(null)
    setSlow(false)
    setStuck(false)
    setLoadFailed(false)
    setActiveIndex(0)
    setLoops(1)
    lastGrownAt.current = 0
    setNewCount(0)
    feedVersion.current += 1
    setExpandedId(null)
  }

  // "Try again" after the first load failed or seems stuck: start it over.
  function retryLoad() {
    setPosts(null)
    setError(null)
    setSlow(false)
    setStuck(false)
    setNewCount(0)
    feedVersion.current += 1
    setAttempt((n) => n + 1)
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
      scrollAfterRender.current = 0
    } catch {
      showToast("That post isn't available any more.")
    }
  }

  async function loadMore() {
    if (!cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    const startedIn = mode
    const version = feedVersion.current
    try {
      const page = await fetchNonEmptyPage(cursor, mode === 'following')
      if (modeRef.current !== startedIn || feedVersion.current !== version) return // the feed was replaced while this was loading
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
  // lib/shareLink.ts).
  async function handleShare(post: Post) {
    const result = await sharePost(post)
    if (result === 'copied') showToast('Link copied to clipboard')
    else if (result === 'failed') showToast("Couldn't copy the link")
  }

  const tabs = <FeedTabs mode={mode} onChange={changeMode} />
  if (error)
    return (
      <>
        {tabs}
        <div className="feed-status">
          Couldn't load the feed: {error}
          <button className="feed-end-btn feed-status-btn" type="button" onClick={retryLoad}>
            Try again
          </button>
        </div>
      </>
    )
  if (posts === null)
    return (
      <>
        {tabs}
        <FeedSkeleton slow={slow} onRetry={stuck ? retryLoad : undefined} />
      </>
    )
  if (posts.length === 0)
    return (
      <>
        {tabs}
        <div className="feed-status">
          {mode === 'following'
            ? "Nothing here yet. Tap someone's name on a post and follow them, and their posts will show up here."
            : 'No published posts yet. Be the first to upload one.'}
        </div>
      </>
    )

  // The next reel only starts loading in full once the one you're on can play
  // through (or has no video to load), so the two don't compete for a slow
  // connection and the one you're actually watching arrives first.
  const activePost = activeIndex < slideCount ? posts[activeIndex % postCount] : undefined
  const activeSettled = !activePost || activePost.kind !== 'video' || !activePost.video_url || isReady(activePost.id)

  return (
    <>
    {tabs}
    {newCount > 0 && (
      <button className="feed-new-pill" type="button" onClick={showNewReels}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
        {newCount === 1 ? '1 new reel' : `${newCount} new reels`}
      </button>
    )}
    <div className="feed-scroll" ref={scrollRef}>
      {Array.from({ length: slideCount }, (_, index) => {
        // Slide `index` shows the posts in order, then round again from the top.
        const post = posts[index % postCount]
        const round = Math.floor(index / postCount)
        const expanded = expandedId === post.id
        const paused = pausedIds.has(post.id)
        const liked = post.liked_by_me ?? false
        const isMine = post.user_id === session?.user.id
        return (
          <div
            key={`${round}:${post.id}`}
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
                preload={preloadFor(index, activeIndex, activeSettled)}
                onReady={() => markReady(post.id)}
              />
            )}
            <div className="slide-scrim" />

            <div className="top-controls">
              <div className="pill-group">
                {post.kind === 'video' && (
                  <button className="icon-pill" type="button" aria-label={paused ? 'Play' : 'Pause'} onClick={() => togglePause(post.id)}>
                    {paused ? <PlayIcon /> : <PauseIcon />}
                  </button>
                )}
                <button className="icon-pill" type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
                  {muted ? <MutedIcon /> : <SoundIcon />}
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
                  <CommentIcon />
                </span>
                <span className="count">{post.comment_count ?? 0}</span>
              </button>
              <button className="rail-btn" type="button" onClick={() => handleShare(post)}>
                <span className="circle">
                  <ShareIcon />
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
      {/* Only while older posts are still on their way. Once there are none, the feed
          just goes round again instead of ending on a dead-end card. */}
      {cursor && (
        <div className="feed-slide feed-end" data-index={slideCount}>
          {loadFailed ? (
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
      )}
    </div>
    {commentsPost && (
      <CommentsSheet
        post={commentsPost}
        currentUserId={session?.user.id}
        onClose={() => setCommentsPost(null)}
        onCount={(count) => setPosts((prev) => withCommentCount(prev, commentsPost.id, count))}
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
