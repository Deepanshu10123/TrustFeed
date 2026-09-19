import { useEffect, useState } from 'react'
import { getUserProfile } from '../lib/api'
import { handleForUser } from '../lib/format'
import type { UserProfile } from '../lib/types'
import { VideoThumb } from './VideoThumb'

/** Someone's public profile as a tall panel over the feed -- their picture,
 * name and published posts. Tapping a post opens it in the feed. It's a panel
 * rather than a page so closing it puts you back exactly where you were. */
export function UserProfileSheet({
  userId,
  onClose,
  onOpenPost,
}: {
  userId: string
  onClose: () => void
  onOpenPost: (postId: string) => void
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUserProfile(userId)
      .then(setProfile)
      .catch((e) => setError(e.message))
  }, [userId])

  const handle = profile ? handleForUser(profile.user_id, profile.username) : ''

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
                  </div>
                </div>
              </div>

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
