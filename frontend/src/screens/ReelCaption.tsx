import { badgeClassFor, captionFor, summarizeVerdict } from '../lib/format'
import type { Post } from '../lib/types'

/** The topic, the verdict badge (tap it to see how it was checked) and the
 * caption at the bottom of a reel -- shared by the feed and the profile's reel
 * viewer. The caption shows two lines with a "more" that opens all of it. */
export function ReelCaption({
  post,
  expanded,
  onExpandedChange,
  onOpenEvidence,
}: {
  post: Post
  expanded: boolean
  onExpandedChange: (open: boolean) => void
  onOpenEvidence: (post: Post) => void
}) {
  const verdict = summarizeVerdict(post.report?.report?.verdicts ?? [])
  const badgeClass = badgeClassFor(verdict?.label)
  // What the collapsed caption shows: the video's transcript, or for a
  // text post (whose text is already the big quote) the verdict's
  // explanation. Opening it reveals everything.
  const caption = post.kind === 'video' ? captionFor(post) : ''
  const explanation = verdict?.explanation ?? post.report?.report?.summary ?? ''
  const preview = caption || explanation
  const hasMore = (caption !== '' && explanation !== '') || preview.length > 60

  return (
    <>
      <div className="tag-row">
        <span className="topic-chip">{post.declared_topic}</span>
        <button
          className={`badge ${badgeClass}`}
          type="button"
          aria-label="See how this was checked"
          onClick={() => onOpenEvidence(post)}
        >
          {verdict?.label ?? 'No factual claims'}
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      {expanded ? (
        <div className="post-text">
          {caption && <div className="caption">{caption}</div>}
          {explanation && <div className="verdict-explanation">{explanation}</div>}
          <button className="more-btn" type="button" onClick={() => onExpandedChange(false)}>
            less
          </button>
        </div>
      ) : hasMore ? (
        <button className="post-text-btn" type="button" onClick={() => onExpandedChange(true)}>
          <span className="caption clamped">{preview}</span>
          <span className="more-btn">more</span>
        </button>
      ) : (
        preview && <div className="caption">{preview}</div>
      )}
    </>
  )
}
