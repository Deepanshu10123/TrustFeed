import { useCallback, useEffect, useRef, useState } from 'react'
import { deletePost, getMyPosts, getProfile, progressStreamUrl, retryPost, uploadAvatar } from '../lib/api'
import type { Post, PostStatus } from '../lib/types'
import { previewFor, suggestUsername, timeAgo } from '../lib/format'
import { forgetSavedFeed } from '../lib/feedCache'
import { savedProfile, saveProfile } from '../lib/myProfileCache'
import { useAuth } from '../hooks/useAuth'
import { ProfileReels } from './ProfileReels'
import { ProfileSkeleton } from './Skeletons'
import { UsernameSheet } from './UsernameSheet'
import { VideoThumb } from './VideoThumb'
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

// The raw error isn't shown -- it's technical -- just which kind of failure.
function failureMessage(post: Post): string {
  return post.report?.error?.includes('took too long')
    ? 'This took too long and was stopped.'
    : 'Something went wrong while checking this post.'
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

export function MyPostsScreen({ userId, refreshSignal }: { userId: string; refreshSignal: number }) {
  // What this screen showed last time, if nothing has changed since. It opens
  // with that, and the fresh data (fetched below either way) is swapped in.
  const [saved] = useState(() => savedProfile(userId, refreshSignal))
  const [posts, setPosts] = useState<Post[] | null>(saved?.posts ?? null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { session } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(saved?.avatarUrl ?? null)
  const [username, setUsernameValue] = useState<string | null>(saved?.username ?? null)
  // null until the server has said -- shown as a dash, not as a made-up 0
  const [followerCount, setFollowerCount] = useState<number | null>(saved?.followerCount ?? null)
  const [followingCount, setFollowingCount] = useState<number | null>(saved?.followingCount ?? null)
  const [editingUsername, setEditingUsername] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [selected, setSelected] = useState<Post | null>(null)
  // The reel that was tapped, while the reel viewer is open over the grid.
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  // Something is already on screen, so a refresh that fails shouldn't wipe it.
  const hasContent = useRef(saved !== null)

  const load = useCallback(() => {
    getMyPosts()
      .then((fresh) => {
        hasContent.current = true
        setPosts(fresh)
      })
      .catch((e) => {
        if (!hasContent.current) setError(e.message)
      })
  }, [])

  // Keep the copy for next time up to date with whatever is on screen.
  useEffect(() => {
    if (posts) saveProfile(userId, refreshSignal, { posts, avatarUrl, username, followerCount, followingCount })
  }, [userId, refreshSignal, posts, avatarUrl, username, followerCount, followingCount])

  useEffect(() => {
    load()
  }, [load, refreshSignal])

  useEffect(() => {
    getProfile()
      .then((p) => {
        setAvatarUrl(p.avatar_url)
        setUsernameValue(p.username)
        // `?? null`: right after an update the site can briefly be newer than the server
        setFollowerCount(p.follower_count ?? null)
        setFollowingCount(p.following_count ?? null)
      })
      .catch(() => {}) // no profile row yet just means no avatar or username set -- not worth surfacing as an error
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

  async function handleRetry(postId: string) {
    setRetrying(true)
    setRetryError(null)
    try {
      await retryPost(postId)
      load()
    } catch {
      setRetryError("Couldn't put it back in the queue. Please try again in a moment.")
    } finally {
      setRetrying(false)
    }
  }

  // Returns why it failed, if it did (the reel viewer covers this screen, so it
  // shows that itself); null when it worked or the person changed their mind.
  async function handleDelete(postId: string): Promise<string | null> {
    if (!window.confirm('Delete this post? This removes it everywhere, including the shared feed.')) return null
    setDeleteError(null)
    try {
      await deletePost(postId)
      forgetSavedFeed() // it may be in the feed you left -- load that again too
      setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? prev) // gone from the screen straight away
      load()
      return null
    } catch (e) {
      setDeleteError((e as Error).message)
      return (e as Error).message
    }
  }

  if (error) return <div className="panel-padding">Couldn't load your posts: {error}</div>
  if (posts === null) return <ProfileSkeleton />

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
          <div className="profile-info">
            <button className={`profile-name${username ? '' : ' unset'}`} type="button" onClick={() => setEditingUsername(true)}>
              {username ? `@${username}` : 'Choose a username'}
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="profile-stats-row">
          <div className="stat">
            <strong>{posts.length}</strong>
            <span>Posts</span>
          </div>
          <div className="stat">
            <strong>{publishedCount}</strong>
            <span>Published</span>
          </div>
          <div className="stat">
            <strong>{followerCount ?? '–'}</strong>
            <span>Followers</span>
          </div>
          <div className="stat">
            <strong>{followingCount ?? '–'}</strong>
            <span>Following</span>
          </div>
        </div>

        {deleteError && <div className="status-sub delete-error">Couldn't delete that post: {deleteError}</div>}

        {posts.length === 0 ? (
          <div className="empty-note">You haven't posted anything yet.</div>
        ) : (
          <div className="profile-grid">
            {posts.map((post) => (
              <button
                key={post.id}
                className="grid-tile"
                onClick={() => {
                  // A posted reel opens to watch; the rest (still checking,
                  // rejected, failed...) open their status panel.
                  if (post.status === 'published') {
                    setViewingId(post.id)
                  } else {
                    setSelected(post)
                    setRetryError(null)
                  }
                }}
                type="button"
              >
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

      {viewingId && (
        <ProfileReels
          posts={posts}
          startId={viewingId}
          currentUserId={userId}
          onClose={() => setViewingId(null)}
          onDelete={handleDelete}
        />
      )}

      {editingUsername && (
        <UsernameSheet
          current={username}
          suggestion={suggestUsername(session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name, session?.user.email)}
          onClose={() => setEditingUsername(false)}
          onSaved={(name) => {
            setUsernameValue(name)
            setEditingUsername(false)
          }}
        />
      )}

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
            {selected.status === 'failed' && (
              <>
                <div className="status-sub">{failureMessage(selected)} You can try again.</div>
                {retryError && <div className="status-sub delete-error">{retryError}</div>}
                <button className="retry-btn" type="button" disabled={retrying} onClick={() => handleRetry(selected.id)}>
                  {retrying ? 'Sending...' : 'Try again'}
                </button>
              </>
            )}
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
