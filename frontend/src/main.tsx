import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ErrorBoundary.tsx'
import { initErrorTracking } from './lib/monitoring'

// Counts visits (Vercel Web Analytics: no cookies, no personal data). It only
// reports once Analytics is switched on for the project in Vercel's dashboard.
inject()

// Reports crashes to Sentry -- only once VITE_SENTRY_DSN is set.
initErrorTracking()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
