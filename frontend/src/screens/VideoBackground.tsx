import { useEffect, useRef, useState } from 'react'

/** Plays only while its own slide is actually visible in the snap-scroll
 * feed -- otherwise every video in the feed would play at once. Starts
 * muted because browsers block autoplay-with-sound outright; `muted` is
 * set imperatively (not just as a JSX prop) since browsers don't reliably
 * react to that prop changing on an already-playing video. `paused` is the
 * viewer's own choice via the pause button -- it holds the video still even
 * while its slide is on screen. */
export function VideoBackground({
  src,
  muted,
  paused,
  preload,
}: {
  src: string
  muted: boolean
  paused: boolean
  preload: 'auto' | 'metadata'
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const visibleRef = useRef(false)
  const pausedRef = useRef(paused)
  // Whether there's a picture yet -- until then (or if it stalls) a small ring
  // turns, so a slow connection doesn't look like a dead screen.
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  // Every fresh fetch of a post list brings a new signature in each video's
  // address (as when My Posts refreshes while something is still being checked).
  // Once a video has loaded it keeps the address that worked, so a refresh can't
  // reload it under the viewer's eyes; until then it follows the newest one.
  const [working, setWorking] = useState<string | null>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
        if (entry.isIntersecting && !pausedRef.current) video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.6 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    pausedRef.current = paused
    const video = ref.current
    if (!video) return
    if (paused) video.pause()
    else if (visibleRef.current) video.play().catch(() => {})
  }, [paused])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [muted])

  return (
    <>
      <video
        ref={ref}
        src={working ?? src}
        preload={preload}
        muted
        loop
        playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        onLoadedData={() => {
          setStatus('ready')
          setWorking((current) => current ?? src)
        }}
        onPlaying={() => setStatus('ready')}
        onWaiting={() => setStatus('loading')}
        onError={() => setStatus('failed')}
      />
      {status === 'loading' && <span className="video-loading" aria-hidden="true" />}
    </>
  )
}
