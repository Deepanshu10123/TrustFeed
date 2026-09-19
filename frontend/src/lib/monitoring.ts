import { redactDeep } from './redact'

// Error tracking (Sentry) -- optional. Without VITE_SENTRY_DSN nothing is
// loaded and nothing is sent. With it, Sentry's code is fetched in the
// background right after the app starts, so it never slows the first screen.

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

type Sentry = typeof import('@sentry/browser')
let ready: Promise<Sentry | null> | null = null

export function initErrorTracking(): void {
  if (!DSN || ready) return
  ready = import('@sentry/browser')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        // Not bugs: the browser's ways of saying "the network dropped" (which
        // includes waking the sleeping free-tier server) and a harmless layout note.
        ignoreErrors: [
          'Failed to fetch',
          'Load failed',
          'NetworkError when attempting to fetch resource',
          'ResizeObserver loop',
        ],
        beforeSend: (event) => redactDeep(event),
        beforeBreadcrumb: (crumb) => redactDeep(crumb),
      })
      return Sentry
    })
    .catch(() => null) // couldn't load (offline, an ad blocker) -- the app carries on
}

/** For a crash we caught ourselves (see ErrorBoundary). Errors nobody caught
 * are picked up by Sentry on its own. */
export function reportError(error: unknown): void {
  void ready?.then((Sentry) => Sentry?.captureException(error))
}
