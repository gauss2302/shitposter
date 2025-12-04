interface TwitterUserContext {
  accessToken: string;
}

/**
 * Upload media to Twitter and return media ID
 * Supports images (jpg, png, gif, webp) and videos (mp4)
 */
export async function uploadMediaToTwitter(
  context: TwitterUserContext,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  // Convert buffer to base64
  const mediaData = fileBuffer.toString("base64");

  // Determine media category
  const isVideo = mimeType.startsWith("video/");
  const mediaCategory = isVideo ? "tweet_video" : "tweet_image";

  // Upload using Twitter API v1.1 (v2 doesn't have media upload yet)
  const response = await fetch(
    "https://upload.twitter.com/1.1/media/upload.json",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        media_data: mediaData,
        media_category: mediaCategory,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Twitter media upload error:", error);
    throw new Error(`Failed to upload media: ${error}`);
  }

  const data = await response.json();

  // For videos, we need to wait for processing
  if (isVideo && data.processing_info) {
    return await waitForVideoProcessing(context, data.media_id_string);
  }

  return data.media_id_string;
}

/**
 * Wait for Twitter to process uploaded video
 */
async function waitForVideoProcessing(
  context: TwitterUserContext,
  mediaId: string,
  maxAttempts: number = 30
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://upload.twitter.com/1.1/media/upload.json?${new URLSearchParams({
        command: "STATUS",
        media_id: mediaId,
      })}`,
      {
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to check video processing status");
    }

    const data = await response.json();
    const state = data.processing_info?.state;

    if (state === "succeeded") {
      return mediaId;
    }

    if (state === "failed") {
      throw new Error(
        `Video processing failed: ${
          data.processing_info?.error?.message || "Unknown error"
        }`
      );
    }

    // Wait before next check (Twitter recommends check_after_secs)
    const waitTime = (data.processing_info?.check_after_secs || 2) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  throw new Error("Video processing timeout");
}

/**
 * Upload multiple media files and return media IDs
 */
export async function uploadMultipleMedia(
  context: TwitterUserContext,
  files: Array<{ buffer: Buffer; mimeType: string }>
): Promise<string[]> {
  const mediaIds: string[] = [];

  // Twitter allows up to 4 images or 1 video per tweet
  const hasVideo = files.some((f) => f.mimeType.startsWith("video/"));

  if (hasVideo && files.length > 1) {
    throw new Error("Cannot attach multiple files when including a video");
  }

  if (files.length > 4) {
    throw new Error("Maximum 4 images allowed per tweet");
  }

  // Upload files sequentially (parallel might hit rate limits)
  for (const file of files) {
    try {
      const mediaId = await uploadMediaToTwitter(
        context,
        file.buffer,
        file.mimeType
      );
      mediaIds.push(mediaId);
    } catch (error) {
      console.error("Failed to upload media file:", error);
      // Continue with other files
    }
  }

  return mediaIds;
}

/**
 * Validate media file before upload
 */
export function validateMediaFile(
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  // Supported image types
  const supportedImages = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  // Supported video types
  const supportedVideos = ["video/mp4"];

  const isImage = supportedImages.includes(mimeType);
  const isVideo = supportedVideos.includes(mimeType);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported: JPG, PNG, GIF, WebP, MP4`,
    };
  }

  // Size limits (Twitter's limits)
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_VIDEO_SIZE = 512 * 1024 * 1024; // 512MB

  if (isImage && fileSize > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `Image too large. Maximum size: 5MB`,
    };
  }

  if (isVideo && fileSize > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: `Video too large. Maximum size: 512MB`,
    };
  }

  return { valid: true };
}
