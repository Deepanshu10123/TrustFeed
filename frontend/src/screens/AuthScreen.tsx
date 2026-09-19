import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import './AuthScreen.css'

export function AuthScreen() {
  const { signUp, signIn, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
    setSubmitting(false)
    if (error) setError(error.message)
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    // On success the page navigates away to Google immediately -- this
    // only ever runs again if that redirect itself failed to start.
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div>
        <div className="eyebrow">Verified Feed</div>
        <div className="wordmark">TrustFeed</div>
        <div className="tagline">The feed that shows its work.</div>
      </div>

      <button className="btn-google" onClick={handleGoogle} disabled={googleLoading} type="button">
        <svg viewBox="0 0 48 48" width="18" height="18">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 45c5.4 0 10.3-2.1 14-5.5l-6.5-5.5C29.4 35.9 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 40.6 16.3 45 24 45z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5C41.5 35.7 45 30.4 45 24c0-1.4-.1-2.7-.4-3.5z" />
        </svg>
        {googleLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>

      <div className="auth-divider"><span>or</span></div>

      <div className="segmented">
        <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
          Log in
        </button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</div>

        <div className="field">
          <label className="field-label">Email</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field-label">Password</label>
          <input
            className="field-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      <div className="fineprint">By continuing you agree this feed checks what it shows you before it shows it.</div>
    </div>
  )
}
