import { useState } from 'react'
import { setUsername } from '../lib/api'

// The same rules as the API's app/core/usernames.py, so an unusable name is
// caught here before anything is sent.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/

/** Choose or change your username. It replaces the anonymous `@user-1a2b3c`
 * people see on your posts and comments. */
export function UsernameSheet({
  current,
  suggestion,
  onClose,
  onSaved,
}: {
  current: string | null
  suggestion: string
  onClose: () => void
  onSaved: (username: string) => void
}) {
  const [draft, setDraft] = useState(current ?? suggestion)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const name = draft.trim().toLowerCase().replace(/^@/, '')
    if (!USERNAME_PATTERN.test(name)) {
      setError('Usernames are 3 to 20 letters, numbers or underscores.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await setUsername(name)
      onSaved(saved.username)
    } catch (e) {
      setError((e as Error).message) // the API's own sentence, e.g. that it's taken
      setSaving(false)
    }
  }

  return (
    <div className="post-detail-overlay" onClick={onClose}>
      <div className="post-detail-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="detail-close" onClick={onClose} type="button" aria-label="Close">
          &times;
        </button>
        <form
          className="username-form"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="username-title">{current ? 'Change your username' : 'Choose a username'}</div>
          <div className="username-field">
            <span className="username-at">@</span>
            <input
              className="field-input"
              value={draft}
              maxLength={21}
              placeholder="yourname"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <div className="status-sub">
            3 to 20 letters, numbers or underscores. It shows on your posts and comments in place of your anonymous id.
          </div>
          {error && <div className="status-sub delete-error">{error}</div>}
          <button className="save-btn" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}
