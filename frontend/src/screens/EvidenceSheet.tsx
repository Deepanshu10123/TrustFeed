import type { Post } from '../lib/types'
import { badgeClassFor } from '../lib/format'

function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** "How this was checked" for one post: how well it matched its topic, and
 * for each factual claim the verdict plus the web sources the checker
 * actually relied on. Source links come from web search, so they're
 * untrusted -- only plain http(s) links are ever made clickable. */
export function EvidenceSheet({ post, onClose }: { post: Post; onClose: () => void }) {
  const verdicts = post.report?.report?.verdicts ?? []

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <span>How this was checked</span>
          <button className="sheet-close" onClick={onClose} type="button" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="sheet-list">
          {post.relevance_score != null && (
            <div className="evidence-topic">
              <span>Matches its topic &ldquo;{post.declared_topic}&rdquo;</span>
              <strong>{post.relevance_score}/100</strong>
            </div>
          )}

          {verdicts.length === 0 && (
            <div className="evidence-note">
              No checkable factual claims were found in this post, so there was nothing to verify.
            </div>
          )}

          {verdicts.map((verdict, i) => {
            const links = verdict.sources.flatMap((source) => {
              const url = parseHttpUrl(source.url)
              return url ? [{ source, url }] : []
            })
            return (
              <div className="evidence-claim" key={i}>
                <div className="evidence-claim-text">&ldquo;{verdict.claim}&rdquo;</div>
                <span className={`badge ${badgeClassFor(verdict.label)}`}>{verdict.label}</span>
                <p className="evidence-explanation">{verdict.explanation}</p>
                {links.length > 0 ? (
                  <ul className="evidence-sources">
                    {links.map(({ source, url }) => (
                      <li key={url.href}>
                        <a href={url.href} target="_blank" rel="noopener noreferrer">
                          {source.title || url.hostname}
                        </a>
                        <span className="evidence-host">{url.hostname.replace(/^www\./, '')}</span>
                        {source.snippet && <span className="evidence-snippet">{source.snippet}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="evidence-note">No sources were kept for this claim.</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
