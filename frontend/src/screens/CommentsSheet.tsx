import { useEffect, useState } from 'react'
import { addComment, deleteComment, getComments } from '../lib/api'
import type { Comment, Post } from '../lib/types'
import { handleForUser, timeAgo } from '../lib/format'

/** A comment thread for one post, opened over the whole screen as a bottom
 * sheet. No moderation beyond sign-in and "delete your own, or delete
 * anything on your own post" -- a real launch would need more than that,
 * same honest gap as post content itself (ADR 0002). */
export function CommentsSheet({
  post,
  currentUserId,
  onClose,
  onOpenProfile,
}: {
  post: Post
  currentUserId: string | undefined
  onClose: () => void
  // Where a commenter's name leads; without it the name is plain text.
  onOpenProfile?: (userId: string) => void
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
                  {onOpenProfile ? (
                    <button className="comment-handle comment-link" type="button" onClick={() => onOpenProfile(c.user_id)}>
                      {handleForUser(c.user_id, c.username)}
                    </button>
                  ) : (
                    <span className="comment-handle">{handleForUser(c.user_id, c.username)}</span>
                  )}
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
