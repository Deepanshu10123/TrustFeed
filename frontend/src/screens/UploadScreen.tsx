import { useState } from 'react'
import { createTextPost, createVideoPost, type UploadProgress } from '../lib/api'
import { MAX_VIDEO_MB, MAX_VIDEO_SECONDS } from '../lib/limits'
import { TOPICS } from '../lib/topics'
import { formatBytes, formatDuration, readVideoDuration } from '../lib/videoFile'
import './UploadScreen.css'

const CUSTOM_TOPIC = '__custom__'

export function UploadScreen({ onUploaded }: { onUploaded: (postId: string) => void }) {
  const [postType, setPostType] = useState<'text' | 'video'>('text')
  const [text, setText] = useState('')
  const [video, setVideo] = useState<File | null>(null)
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const isCustomTopic = topic === CUSTOM_TOPIC
  const finalTopic = isCustomTopic ? customTopic.trim() : topic

  // Too big or too long is caught here, before anything is uploaded, rather
  // than after waiting for a big file to go up and be turned away.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so picking the same file again still counts as a change
    if (!file) return
    setMessage(null)

    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setVideo(null)
      setMessage({ kind: 'error', text: `That video is ${formatBytes(file.size)}. The limit is ${MAX_VIDEO_MB} MB.` })
      return
    }
    const seconds = await readVideoDuration(file)
    if (seconds !== null && seconds > MAX_VIDEO_SECONDS) {
      setVideo(null)
      setMessage({
        kind: 'error',
        text: `That video is ${formatDuration(seconds)} long. The limit is ${MAX_VIDEO_SECONDS / 60} minutes.`,
      })
      return
    }
    setVideo(file)
  }

  function submitLabel(): string {
    if (!submitting) return 'Submit for review'
    if (!progress) return 'Submitting...'
    return progress.sent ? 'Finishing up...' : `Uploading ${progress.percent}%`
  }

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
      let created: { post_id: string }
      if (postType === 'text') {
        created = await createTextPost(finalTopic, text)
      } else {
        setProgress({ percent: 0, sent: false })
        created = await createVideoPost(finalTopic, video as File, setProgress)
      }
      setMessage({ kind: 'success', text: 'Submitted -- check My Posts for its status.' })
      setText('')
      setVideo(null)
      setTopic('')
      setCustomTopic('')
      onUploaded(created.post_id)
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
    } finally {
      setSubmitting(false)
      setProgress(null)
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
            <input type="file" accept="video/*" onChange={handleFileChange} />
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M8 8l4-4 4 4" />
              <path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
            </svg>
            <div className="dz-title">{video ? video.name : 'Tap to choose a video'}</div>
            <div className="dz-sub">
              {video ? formatBytes(video.size) : `MP4, up to ${MAX_VIDEO_SECONDS / 60} minutes and ${MAX_VIDEO_MB} MB`}
            </div>
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

      {progress && (
        <div
          className="upload-progress"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <div className="upload-progress-bar" style={{ width: `${progress.percent}%` }} />
        </div>
      )}

      {message && <div className={`upload-message ${message.kind}`}>{message.text}</div>}

      <button className="btn-primary" onClick={handleSubmit} disabled={submitting} type="button">
        {submitLabel()}
      </button>
    </div>
  )
}
