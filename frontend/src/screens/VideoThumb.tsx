import { useRef, useState } from 'react'

/** A grid tile's video preview -- forcing currentTime forward a touch
 * once metadata loads makes the browser actually paint a real frame
 * instead of a blank black square, without needing canvas/CORS tricks.
 *
 * Every fetch of a post list brings a fresh signature in each video's address.
 * Reloading the tile for that would make it flash, so once a tile has loaded
 * it sticks with the address that worked; until then (or if that first
 * address had already expired) it follows the newest one. */
export function VideoThumb({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [working, setWorking] = useState<string | null>(null)
  return (
    <video
      ref={ref}
      src={working ?? src}
      className="grid-thumb-video"
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={() => {
        setWorking((current) => current ?? src)
        if (ref.current) ref.current.currentTime = 0.1
      }}
    />
  )
}
