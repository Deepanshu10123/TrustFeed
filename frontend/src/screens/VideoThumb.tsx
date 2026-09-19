import { useRef } from 'react'

/** A grid tile's video preview -- forcing currentTime forward a touch
 * once metadata loads makes the browser actually paint a real frame
 * instead of a blank black square, without needing canvas/CORS tricks. */
export function VideoThumb({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  return (
    <video
      ref={ref}
      src={src}
      className="grid-thumb-video"
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={() => {
        if (ref.current) ref.current.currentTime = 0.1
      }}
    />
  )
}
