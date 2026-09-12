import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import './AuthScreen.css'

export function AuthScreen() {
  const { signUp, signIn } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = mode === 'login' ? await signIn(email, password) : await signUp(email, password)
    setSubmitting(false)
    if (error) setError(error.message)
  }

  return (
    <div className="auth-wrap">
      <div>
        <div className="eyebrow">Verified Feed</div>
        <div className="wordmark">TrustFeed</div>
        <div className="tagline">The feed that shows its work.</div>
      </div>

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
