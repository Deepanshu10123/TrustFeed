import { Component, type ReactNode } from 'react'
import { reportError } from './lib/monitoring'

/** If a screen crashes while it's being drawn, React would otherwise leave a
 * blank page with no way out. This shows a short apology and a Reload button
 * instead, and tells error tracking about it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: Error) {
    reportError(error)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="crash-screen" role="alert">
        <h1>Something went wrong</h1>
        <p>TrustFeed hit an unexpected problem. Reloading usually fixes it.</p>
        <button className="crash-btn" type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
