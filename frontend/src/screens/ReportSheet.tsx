import { useState } from 'react'
import { reportPost } from '../lib/api'
import type { Post } from '../lib/types'

// The ids have to match REPORT_REASONS in the backend's main.py.
const REASONS = [
  { id: 'misleading', label: 'False or misleading' },
  { id: 'hateful', label: 'Hateful or harassing' },
  { id: 'dangerous', label: 'Violent or dangerous' },
  { id: 'spam', label: 'Spam or a scam' },
  { id: 'other', label: 'Something else' },
]

/** Asks why a post is being reported and sends it. Several different
 * people reporting the same post takes it out of the feed for everyone
 * (see the API's report endpoint). */
export function ReportSheet({
  post,
  onClose,
  onReported,
}: {
  post: Post
  onClose: () => void
  onReported: (postId: string) => void
}) {
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!reason) return
    setSubmitting(true)
    setError(null)
    try {
      await reportPost(post.id, reason, note.trim() || undefined)
      onReported(post.id)
    } catch {
      setError("Couldn't send your report. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <span>Report this post</span>
          <button className="sheet-close" onClick={onClose} type="button" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="sheet-list">
          <div className="report-intro">Why are you reporting it?</div>
          {REASONS.map((r) => (
            <button
              key={r.id}
              className={`report-reason${reason === r.id ? ' selected' : ''}`}
              type="button"
              aria-pressed={reason === r.id}
              onClick={() => setReason(r.id)}
            >
              {r.label}
              <span className="report-radio" />
            </button>
          ))}
          <input
            className="report-note"
            placeholder="Add a note (optional)"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <div className="report-error">{error}</div>}
        </div>
        <div className="report-footer">
          <button className="report-submit" type="button" disabled={!reason || submitting} onClick={submit}>
            {submitting ? 'Sending...' : 'Send report'}
          </button>
        </div>
      </div>
    </div>
  )
}
