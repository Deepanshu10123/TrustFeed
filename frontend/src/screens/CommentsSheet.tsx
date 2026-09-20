import { useEffect, useState } from 'react'
import { addComment, deleteComment, getComments } from '../lib/api'
import type { Comment, Post } from '../lib/types'
import { handleForUser, timeAgo } from '../lib/format'

// While the sheet is open it looks for new comments this often (not while the app is hidden).
const REFRESH_EVERY_MS = 6_000

const sameComments = (a: Comment[], b: Comment[]) => a.length === b.length && a.every((c, i) => c.id === b[i].id)

/** A comment thread for one post, opened over the whole screen as a bottom
 * sheet. No moderation beyond sign-in and "delete your own, or delete
 * anything on your own post" -- a real launch would need more than that,
 * same honest gap as post content itself (ADR 0002). */
export function CommentsSheet({
  post,
  currentUserId,
  onClose,
  onOpenProfile,
  onCount,
}: {
  post: Post
  currentUserId: string | undefined
  onClose: () => void
  // Where a commenter's name leads; without it the name is plain text.
  onOpenProfile?: (userId: string) => void
  // Told how many comments there are whenever the list is loaded, so the number on the reel stays right.
  onCount?: (count: number) => void
}) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)

  // `quiet` is for the automatic refreshes: a hiccup then isn't worth an error message
  // over comments that are already on screen. The list is only replaced when it really
  // changed, so nothing redraws (or jumps) while you read or type.
  function load(quiet = false) {
    getComments(post.id)
      .then((list) => {
        setComments((prev) => (prev && sameComments(prev, list) ? prev : list))
        setError(null)
        onCount?.(list.length)
      })
      .catch((e) => {
        if (!quiet) setError(e.message)
      })
  }

  useEffect(() => load(), [post.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(true)
    }, REFRESH_EVERY_MS)
    return () => clearInterval(timer)
  }, [post.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
