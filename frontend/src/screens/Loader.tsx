import { useEffect, useState, type ReactNode } from 'react'

/** The app's loading animation: a check mark drawing itself inside a ring --
 * "checked" is the whole idea of the app. The same markup sits in index.html,
 * so it's on screen before any code has loaded; keep the two in step.
 * `note` is a line of explanation under it; `children` is for a button. */
export function Loader({ note, children }: { note?: string; children?: ReactNode }) {
  return (
    <div className="loader">
      <svg
        className="loader-mark"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle className="loader-ring" cx="32" cy="32" r="27" pathLength="1" />
        <path className="loader-check" d="M20 33.5l8.5 8.5L44 24" pathLength="1" />
      </svg>
      <div className="loader-word">TrustFeed</div>
      {note && <p className="loader-note">{note}</p>}
      {children}
    </div>
  )
}

/** Full screen, for the moment before the app knows who you are. If that takes
 * suspiciously long it says so and offers a reload, instead of animating for ever. */
export function Splash() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 10000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="splash" role="status" aria-label="Loading TrustFeed">
      <Loader note={slow ? 'This is taking longer than usual. Your connection may be slow.' : undefined}>
        {slow && (
          <button className="loader-btn" type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        )}
      </Loader>
    </div>
  )
}
