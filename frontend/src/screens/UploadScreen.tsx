import { useState } from 'react'
import { createTextPost, createVideoPost } from '../lib/api'
import { TOPICS } from '../lib/topics'
import './UploadScreen.css'

const CUSTOM_TOPIC = '__custom__'

export function UploadScreen({ onUploaded }: { onUploaded: () => void }) {
  const [postType, setPostType] = useState<'text' | 'video'>('text')
  const [text, setText] = useState('')
  const [video, setVideo] = useState<File | null>(null)
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const isCustomTopic = topic === CUSTOM_TOPIC
  const finalTopic = isCustomTopic ? customTopic.trim() : topic

  async function handleSubmit() {
    if (!finalTopic) {
      setMessage({ kind: 'error', text: isCustomTopic ? 'Type your topic first.' : 'Pick a topic first.' })
      return
    }
    if (postType === 'text' && !text.trim()) {
      setMessage({ kind: 'error', text: 'Write something to check first.' })
      return
    }
    if (postType === 'video' && !video) {
      setMessage({ kind: 'error', text: 'Choose a video file first.' })
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      if (postType === 'text') {
        await createTextPost(finalTopic, text)
      } else {
        await createVideoPost(finalTopic, video as File)
      }
      setMessage({ kind: 'success', text: 'Submitted -- check My Posts for its status.' })
      setText('')
      setVideo(null)
      setTopic('')
      setCustomTopic('')
      onUploaded()
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="panel-padding">
      <div className="segmented">
        <button className={postType === 'text' ? 'active' : ''} onClick={() => setPostType('text')} type="button">
          Text
        </button>
        <button className={postType === 'video' ? 'active' : ''} onClick={() => setPostType('video')} type="button">
          Video
        </button>
      </div>

      {postType === 'text' ? (
        <div className="field">
          <label className="field-label">What are you sharing?</label>
          <textarea
            className="field-input"
            rows={6}
            placeholder="Write the claim or post you want checked..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Video</label>
          <div className="dropzone">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
            />
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M8 8l4-4 4 4" />
              <path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
            </svg>
            <div className="dz-title">{video ? video.name : 'Tap to choose a video'}</div>
            <div className="dz-sub">MP4, up to 2 minutes</div>
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label">
          Topic <span className="req">Required</span>
        </label>
        <select className="field-input" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="" disabled>
            Choose a topic...
          </option>
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
          <option value={CUSTOM_TOPIC}>Something else...</option>
        </select>
        {isCustomTopic && (
          <input
            className="field-input"
            placeholder="Type your own topic"
            value={customTopic}
            maxLength={40}
            onChange={(e) => setCustomTopic(e.target.value)}
          />
        )}
        <div className="field-hint">
          {isCustomTopic
            ? "Shown on your post like any other tag -- just not one people can filter their feed by, only the list above is."
            : "This is what your post gets checked against before it's shown to anyone."}
        </div>
      </div>

      {message && <div className={`upload-message ${message.kind}`}>{message.text}</div>}

      <button className="btn-primary" onClick={handleSubmit} disabled={submitting} type="button">
        {submitting ? 'Submitting...' : 'Submit for review'}
      </button>
    </div>
  )
}
