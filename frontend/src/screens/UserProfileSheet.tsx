import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { followUser, getUserProfile, unfollowUser } from '../lib/api'
import { handleForUser } from '../lib/format'
import type { UserProfile } from '../lib/types'
import { VideoThumb } from './VideoThumb'

/** Someone's public profile as a tall panel over the feed -- their picture,
 * name, follower counts and published posts. Tapping a post opens it in the
 * feed. It's a panel rather than a page so closing it puts you back exactly
 * where you were. */
export function UserProfileSheet({
  userId,
  onClose,
  onOpenPost,
}: {
  userId: string
  onClose: () => void
  onOpenPost: (postId: string) => void
}) {
  const { session } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [followError, setFollowError] = useState<string | null>(null)
  // A follow request still in flight, so a fast double-tap can't race itself.
  const followPending = useRef(false)

  useEffect(() => {
    getUserProfile(userId)
      .then(setProfile)
      .catch((e) => setError(e.message))
  }, [userId])

  const isMe = session?.user.id === userId
  const handle = profile ? handleForUser(profile.user_id, profile.username) : ''

  // Flips the button and the count straight away, then goes with what the
  // server says (its count is the real one) -- or puts things back if it failed.
  async function toggleFollow() {
    if (!profile || followPending.current) return
    followPending.current = true
    setFollowError(null)
    const wasFollowing = profile.is_following
    const before = profile.follower_count
    setProfile({ ...profile, is_following: !wasFollowing, follower_count: Math.max(0, before + (wasFollowing ? -1 : 1)) })
    try {
      const result = await (wasFollowing ? unfollowUser(userId) : followUser(userId))
      setProfile((p) => p && { ...p, is_following: result.following, follower_count: result.follower_count })
    } catch (e) {
      setProfile((p) => p && { ...p, is_following: wasFollowing, follower_count: before })
      setFollowError((e as Error).message)
    } finally {
      followPending.current = false
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet tall" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <span>{profile ? handle : 'Profile'}</span>
          <button className="sheet-close" onClick={onClose} type="button" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="sheet-list">
          {error && <div className="comment-empty">{error}</div>}
          {!profile && !error && <div className="comment-empty">Loading...</div>}
          {profile && (
            <>
              <div className="profile-header">
                <div className="profile-avatar static">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" />
                  ) : (
                    <span className="avatar-placeholder">{handle.charAt(1).toUpperCase()}</span>
                  )}
                </div>
                <div className="profile-info">
                  <div className="user-handle">{handle}</div>
                  <div className="profile-stats">
                    <div className="stat">
                      <strong>{profile.post_count}</strong>
                      <span>Posts</span>
                    </div>
                    <div className="stat">
                      <strong>{profile.follower_count}</strong>
                      <span>Followers</span>
                    </div>
                    <div className="stat">
                      <strong>{profile.following_count}</strong>
                      <span>Following</span>
                    </div>
                  </div>
                </div>
              </div>

              {!isMe && (
                <>
                  <button
                    className={`follow-btn${profile.is_following ? ' following' : ''}`}
                    type="button"
                    aria-pressed={profile.is_following}
                    onClick={toggleFollow}
                  >
                    {profile.is_following ? 'Following' : 'Follow'}
                  </button>
                  {followError && <div className="follow-error">{followError}</div>}
                </>
              )}

              {profile.posts.length === 0 ? (
                <div className="comment-empty">No posts yet.</div>
              ) : (
                <div className="profile-grid">
                  {profile.posts.map((post) => (
                    <button
                      key={post.id}
                      className="grid-tile"
                      type="button"
                      aria-label="Open this post"
                      onClick={() => onOpenPost(post.id)}
                    >
                      {post.kind === 'video' && post.video_url ? (
                        <VideoThumb src={post.video_url} />
                      ) : (
                        <div className="grid-tile-text">{post.content}</div>
                      )}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
