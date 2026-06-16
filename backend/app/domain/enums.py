from enum import StrEnum


class PostStatus(StrEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"


class PostTargetStatus(StrEnum):
    PENDING = "pending"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"


class Platform(StrEnum):
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    LINKEDIN = "linkedin"
    FACEBOOK = "facebook"
    THREADS = "threads"


class VideoProvider(StrEnum):
    REPLICATE = "replicate"
    RUNWAY = "runway"
    FALAI = "falai"


class VideoJobStatus(StrEnum):
    QUEUED = "queued"
    SUBMITTING = "submitting"
    PROCESSING = "processing"
    DOWNLOADING = "downloading"
    UPLOADED = "uploaded"
    FAILED = "failed"
    CANCELED = "canceled"
