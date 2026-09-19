import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePostWatcher } from './hooks/usePostWatcher'
import type { PostStatusRow } from './lib/api'
import { clearSharedPostId, takeSharedPostId } from './lib/shareLink'
import { AuthScreen } from './screens/AuthScreen'
import { FeedScreen } from './screens/FeedScreen'
import { UploadScreen } from './screens/UploadScreen'
import { MyPostsScreen } from './screens/MyPostsScreen'
import { InterestsScreen } from './screens/InterestsScreen'
import './App.css'

type Tab = 'feed' | 'upload' | 'myposts' | 'interests'

// Someone who opened a shared link: the post to show first once they're in.
// Read once, as the app loads, before anything can change the address.
const initialSharedPostId = takeSharedPostId()

const HEADER_TITLES: Record<Tab, string> = {
  feed: 'Feed',
  upload: 'New post',
  myposts: 'My Posts',
  interests: 'Interests',
}

function finishedMessage(post: PostStatusRow): string {
  const what = `${post.declared_topic} ${post.kind === 'video' ? 'video' : 'post'}`
  switch (post.status) {
    case 'published':
      return `Your ${what} is live in the feed.`
    case 'rejected':
      return `Your ${what} wasn't published. Tap to see why.`
    case 'needs_review':
      return `Your ${what} needs a human look before it can be shown.`
    case 'failed':
      return `Something went wrong checking your ${what}. Tap to try again.`
    default:
      return `Your ${what} has been updated.`
  }
}

function App() {
  const { session, loading, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('feed')
  const [myPostsRefresh, setMyPostsRefresh] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [unseen, setUnseen] = useState(0)
  const [sharedPostId, setSharedPostId] = useState<string | null>(initialSharedPostId)

  // Says so when a post you uploaded has been checked, wherever you are in
  // the app -- otherwise you'd have to go and look in My Posts.
  const { watch } = usePostWatcher((post) => {
    if (tab === 'myposts') return // already looking at it -- My Posts shows the change itself
    setNotice(finishedMessage(post))
    setUnseen((n) => n + 1)
  }, session !== null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 7000)
    return () => clearTimeout(timer)
  }, [notice])

  if (loading) return <div className="loading-screen">Loading...</div>
  if (!session) return <AuthScreen />

  return (
    <div className="phone-frame">
      {tab !== 'feed' && (
        <div className="app-header">
          <div className="header-text">
            <div className="eyebrow">TrustFeed</div>
            <div className="title">{HEADER_TITLES[tab]}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {tab !== 'interests' && (
              <button className="sign-out-btn" onClick={() => setTab('interests')} type="button" aria-label="Interests">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
                </svg>
              </button>
            )}
            <button className="sign-out-btn" onClick={() => signOut()} type="button">
              Sign out
            </button>
          </div>
        </div>
      )}

      <div className="app-content">
        {tab === 'feed' && (
          <FeedScreen
            sharedPostId={sharedPostId}
            onSharedHandled={() => {
              clearSharedPostId()
              setSharedPostId(null)
            }}
          />
        )}
        {tab === 'upload' && (
          <UploadScreen
            onUploaded={(postId) => {
              setMyPostsRefresh((n) => n + 1)
              watch(postId)
              setTab('myposts')
            }}
          />
        )}
        {tab === 'myposts' && <MyPostsScreen refreshSignal={myPostsRefresh} />}
        {tab === 'interests' && <InterestsScreen />}
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'feed' ? 'active' : ''}`} onClick={() => setTab('feed')} type="button">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="16" y2="12" />
            <line x1="4" y1="17" x2="12" y2="17" />
          </svg>
          <span className="label">Feed</span>
        </button>
        <button className={`tab-btn ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')} type="button">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="label">Upload</span>
        </button>
        <button
          className={`tab-btn ${tab === 'myposts' ? 'active' : ''}`}
          onClick={() => {
            setTab('myposts')
            setUnseen(0)
          }}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
          </svg>
          {unseen > 0 && <span className="tab-dot" aria-label="New update" />}
          <span className="label">My Posts</span>
        </button>
      </div>

      {notice && (
        <button
          className="app-notice"
          type="button"
          onClick={() => {
            setNotice(null)
            setUnseen(0)
            setTab('myposts')
          }}
        >
          {notice}
        </button>
      )}
    </div>
  )
}

export default App
