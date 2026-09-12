import { useEffect, useState } from 'react'
import { getInterests, setInterests } from '../lib/api'
import { TOPICS } from '../lib/topics'
import './InterestsScreen.css'

export function InterestsScreen() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getInterests()
      .then(({ topics }) => setSelected(new Set(topics)))
      .finally(() => setLoading(false))
  }, [])

  function toggle(topic: string) {
    setSaved(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    await setInterests([...selected])
    setSaving(false)
    setSaved(true)
  }

  if (loading) return <div className="panel-padding">Loading...</div>

  return (
    <div className="panel-padding">
      <div className="interests-hint">
        Pick what you want to see. Leave everything unchecked to see the full, unfiltered feed.
      </div>
      <div className="interests-list">
        {TOPICS.map((topic) => {
          const checked = selected.has(topic)
          return (
            <div
              key={topic}
              className={`interest-row ${checked ? 'checked' : ''}`}
              onClick={() => toggle(topic)}
            >
              {topic[0].toUpperCase() + topic.slice(1)}
              <span className="interest-check">
                {checked && (
                  <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 10.5l3.5 3.5L16 6" />
                  </svg>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <button className="btn-primary" onClick={handleSave} disabled={saving} type="button">
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save interests'}
      </button>
    </div>
  )
}
