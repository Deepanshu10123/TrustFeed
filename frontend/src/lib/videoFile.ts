/** How long a video is, read from its own metadata in the browser -- or null
 * if the browser can't tell (some phone formats, HEVC in desktop Chrome for
 * one, won't load). Those files are let through rather than blocked on a
 * guess. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const timer = setTimeout(() => finish(null), 8000)

    function finish(seconds: number | null) {
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      resolve(seconds)
    }

    video.preload = 'metadata'
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : null)
    video.onerror = () => finish(null)
    video.src = url
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
