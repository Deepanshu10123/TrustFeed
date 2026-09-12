"""
The fixed topic vocabulary (Milestone 6). Shared by both tagging a post
at upload and picking interests, so exact-string matching between the two
just works -- no embeddings needed for a list this size. Mirrored in
frontend/src/lib/topics.ts; keep the two in sync if this ever changes.
"""

TOPICS = [
    "space",
    "science",
    "history",
    "nutrition",
    "technology",
    "wildlife",
    "sports",
    "politics",
    "finance",
    "health",
    "psychology",
    "culture",
]
