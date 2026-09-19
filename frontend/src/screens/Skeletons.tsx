import { Loader } from './Loader'
import './Skeletons.css'

/** Stand-in shapes shown while the feed loads, laid out like the real thing
 * so nothing jumps when it arrives, with the loading animation in the middle.
 * `slow` adds a note for the long first load after the server has been asleep;
 * `onRetry`, given once it's really dragging on, adds a "Try again" button. */
export function FeedSkeleton({ slow, onRetry }: { slow: boolean; onRetry?: () => void }) {
  return (
    <div className="sk-feed" role="status" aria-label="Loading the feed">
      <div className="sk-center">
        <Loader note={slow ? 'Still loading. The server may be waking up, which can take up to a minute after a quiet spell.' : undefined}>
          {onRetry && (
            <button className="loader-btn" type="button" onClick={onRetry}>
              Try again
            </button>
          )}
        </Loader>
      </div>
      <div className="sk-rail">
        <span className="sk sk-circle" />
        <span className="sk sk-circle" />
        <span className="sk sk-circle" />
      </div>
      <div className="sk-info">
        <div className="sk-row">
          <span className="sk sk-avatar" />
          <span className="sk sk-line" style={{ width: '34%' }} />
        </div>
        <span className="sk sk-line" style={{ width: '46%', height: 22 }} />
        <span className="sk sk-line" style={{ width: '88%' }} />
        <span className="sk sk-line" style={{ width: '64%' }} />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="sk-profile" role="status" aria-label="Loading your posts">
      <div className="sk-profile-header">
        <span className="sk sk-avatar-lg" />
        <span className="sk sk-line" style={{ width: 70 }} />
        <span className="sk sk-line" style={{ width: 70 }} />
      </div>
      <div className="sk-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <span className="sk sk-tile" key={i} />
        ))}
      </div>
    </div>
  )
}
