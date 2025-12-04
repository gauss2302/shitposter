interface TwitterUserContext {
  accessToken: string;
}

/**
 * Upload media to Twitter and return media ID
 * Uses chunked upload for reliability with larger files
 */
export async function uploadMediaToTwitter(
  context: TwitterUserContext,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const isVideo = mimeType.startsWith("video/");
  const mediaCategory = isVideo ? "tweet_video" : "tweet_image";
  const totalBytes = fileBuffer.length;

  console.log(`📤 Starting upload: ${totalBytes} bytes, type: ${mimeType}`);

  // INIT phase - Initialize upload
  const initResponse = await fetch(
    "https://upload.twitter.com/1.1/media/upload.json",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        command: "INIT",
        total_bytes: totalBytes.toString(),
        media_type: mimeType,
        media_category: mediaCategory,
      }),
    }
  );

  if (!initResponse.ok) {
    const error = await initResponse.text();
    console.error("Twitter media INIT error:", error);
    throw new Error(`Failed to initialize media upload: ${error}`);
  }

  const initData = await initResponse.json();
  const mediaId = initData.media_id_string;
  console.log(`✅ Initialized upload with media_id: ${mediaId}`);

  // APPEND phase - Upload file in chunks
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  let segmentIndex = 0;

  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const chunk = fileBuffer.slice(
      offset,
      Math.min(offset + chunkSize, totalBytes)
    );

    console.log(`📤 Uploading chunk ${segmentIndex}: ${chunk.length} bytes`);

    const formData = new FormData();
    formData.append("command", "APPEND");
    formData.append("media_id", mediaId);
    formData.append("segment_index", segmentIndex.toString());
    formData.append("media", new Blob([chunk], { type: mimeType }));

    const appendResponse = await fetch(
      "https://upload.twitter.com/1.1/media/upload.json",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
        },
        body: formData,
      }
    );

    if (!appendResponse.ok) {
      const error = await appendResponse.text();
      console.error(
        `Twitter media APPEND error (chunk ${segmentIndex}):`,
        error
      );
      throw new Error(`Failed to upload chunk ${segmentIndex}: ${error}`);
    }

    console.log(`✅ Uploaded chunk ${segmentIndex}`);
    segmentIndex++;
  }

  // FINALIZE phase - Complete upload
  console.log(`🏁 Finalizing upload for media_id: ${mediaId}`);

  const finalizeResponse = await fetch(
    "https://upload.twitter.com/1.1/media/upload.json",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        command: "FINALIZE",
        media_id: mediaId,
      }),
    }
  );

  if (!finalizeResponse.ok) {
    const error = await finalizeResponse.text();
    console.error("Twitter media FINALIZE error:", error);
    throw new Error(`Failed to finalize media upload: ${error}`);
  }

  const finalizeData = await finalizeResponse.json();
  console.log(`✅ Finalized upload:`, finalizeData);

  // For videos, wait for processing
  if (isVideo && finalizeData.processing_info) {
    console.log(`⏳ Video processing required, waiting...`);
    return await waitForVideoProcessing(context, mediaId);
  }

  return mediaId;
}

/**
 * Wait for Twitter to process uploaded video
 */
async function waitForVideoProcessing(
  context: TwitterUserContext,
  mediaId: string,
  maxAttempts: number = 60 // Up to 2 minutes
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
      console.error("Failed to check video processing status");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    const data = await response.json();
    const state = data.processing_info?.state;

    console.log(`📊 Processing status: ${state}`);

    if (state === "succeeded") {
      console.log(`✅ Video processing complete`);
      return mediaId;
    }

    if (state === "failed") {
      throw new Error(
        `Video processing failed: ${
          data.processing_info?.error?.message || "Unknown error"
        }`
      );
    }

    // Wait before next check
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

  console.log(`📸 Uploading ${files.length} media file(s)...`);

  // Upload files sequentially (parallel might hit rate limits)
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`📤 Uploading file ${i + 1}/${files.length}`);

    try {
      const mediaId = await uploadMediaToTwitter(
        context,
        file.buffer,
        file.mimeType
      );
      mediaIds.push(mediaId);
      console.log(`✅ File ${i + 1} uploaded: ${mediaId}`);
    } catch (error) {
      console.error(`❌ Failed to upload file ${i + 1}:`, error);
      throw error; // Don't continue if upload fails
    }
  }

  console.log(`✅ All ${mediaIds.length} files uploaded successfully`);
  return mediaIds;
}

/**
 * Validate media file before upload
 */
export function validateMediaFile(
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  const supportedImages = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  const supportedVideos = ["video/mp4"];

  const isImage = supportedImages.includes(mimeType);
  const isVideo = supportedVideos.includes(mimeType);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported: JPG, PNG, GIF, WebP, MP4`,
    };
  }

  // Size limits
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
