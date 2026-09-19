export type PostKind = 'text' | 'video'
export type PostStatus = 'processing' | 'published' | 'rejected' | 'needs_review' | 'failed'
export type VerdictLabel = 'Well Supported' | 'Mixed Evidence' | 'Unsupported' | 'Unable to Verify'

export interface Source {
  title: string
  url: string
  snippet: string
}

export interface Verdict {
  claim: string
  label: VerdictLabel
  explanation: string
  sources: Source[]
}

export interface Report {
  report?: {
    input_text: string
    verdicts: Verdict[]
    summary: string
  }
  understanding?: {
    transcript: string
    topic: string
    claims: string[]
  }
  error?: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  text: string
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  kind: PostKind
  content: string
  video_url?: string
  declared_topic: string
  status: PostStatus
  relevance_score: number | null
  rejection_reason: string | null
  report: Report | null
  created_at: string
  // Only present on posts that come from the shared feed.
  like_count?: number
  liked_by_me?: boolean
  uploader_avatar_url?: string | null
}
