// The video limits the upload screen shows and checks before anything is
// sent. The API enforces the size itself (MAX_VIDEO_MB in the backend's
// config -- keep the two in step); the length is only checked here.
export const MAX_VIDEO_MB = 50
export const MAX_VIDEO_SECONDS = 120
