import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { inject } from '@vercel/analytics'
import './index.css'
import App from './App.tsx'

// Counts visits (Vercel Web Analytics: no cookies, no personal data). It only
// reports once Analytics is switched on for the project in Vercel's dashboard.
inject()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
