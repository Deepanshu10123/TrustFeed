/** The app's loading animation: a check mark drawing itself inside a ring --
 * "checked" is the whole idea of the app. The same markup sits in index.html,
 * so it's on screen before any code has loaded; keep the two in step. */
export function Loader({ note }: { note?: string }) {
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
    </div>
  )
}

/** Full screen, for the moment before the app knows who you are. */
export function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading TrustFeed">
      <Loader />
    </div>
  )
}
