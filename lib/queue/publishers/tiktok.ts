import { logger } from "@/lib/logger";

interface PublishOptions {
  accessToken: string;
  content: string;
  mediaUrls?: string[];
  videoBuffer?: Buffer; // For direct upload
  videoMimeType?: string; // For direct upload
}

// Validate video file
function validateVideo(buffer: Buffer, mimeType: string): void {
  // Check format
  const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
  const isValidType = allowedTypes.some((type) => mimeType.toLowerCase().includes(type.split("/")[1]));
  if (!isValidType) {
    throw new Error(
      `Invalid video format. TikTok supports: MP4, MOV, AVI, WebM. Got: ${mimeType}`
    );
  }

  // Check size (4GB = 4 * 1024 * 1024 * 1024 bytes)
  const maxSize = 4 * 1024 * 1024 * 1024;
  if (buffer.length > maxSize) {
    throw new Error(
      `Video file too large. Maximum size is 4GB. Got: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`
    );
  }

  // Note: Duration and resolution validation would require video metadata parsing
  // TikTok API will validate these on their end
}

// Upload video directly to TikTok
async function uploadVideoToTikTok(
  accessToken: string,
  videoBuffer: Buffer,
  mimeType: string
): Promise<string> {
  logger.debug("Uploading video to TikTok", {
    sizeMB: (videoBuffer.length / 1024 / 1024).toFixed(2),
    mimeType,
  });

  // Step 1: Initialize inbox upload
  const initResponse = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source_info: {
          source: "FILE_UPLOAD",
        },
        post_info: {
          title: "Uploading...", // Temporary, will be updated in publish step
        },
      }),
    }
  );

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`TikTok inbox init failed: ${errorText}`);
    }
    throw new Error(
      `TikTok inbox init error: ${errorData.error?.message || JSON.stringify(errorData)}`
    );
  }

  const initData = await initResponse.json();

  if (initData.error?.code !== "ok") {
    throw new Error(`TikTok error: ${initData.error?.message}`);
  }

  const uploadUrl = initData.data.upload_url;
  const uploadId = initData.data.upload_id;

  logger.debug("TikTok upload URL received", { uploadId });

  // Step 2: Upload video file to TikTok's upload endpoint
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`TikTok video upload failed: ${errorText}`);
  }

  logger.debug("TikTok video uploaded", { uploadId });

  return uploadId;
}

// TikTok Content Posting API
// Note: TikTok requires video content - no text-only or image posts
export async function publishToTikTok({
  accessToken,
  content,
  mediaUrls,
  videoBuffer,
  videoMimeType,
}: PublishOptions): Promise<string> {
  let publishId: string;

  // Use direct upload if video buffer is provided
  if (videoBuffer && videoMimeType) {
    validateVideo(videoBuffer, videoMimeType);
    const uploadId = await uploadVideoToTikTok(accessToken, videoBuffer, videoMimeType);

    // Initialize publish with uploaded video
    const publishInitResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: content.slice(0, 150), // TikTok title limit
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "FILE_UPLOAD",
            upload_id: uploadId,
          },
        }),
      }
    );

    if (!publishInitResponse.ok) {
      const errorText = await publishInitResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`TikTok publish init failed: ${errorText}`);
      }
      throw new Error(
        `TikTok publish init error: ${errorData.error?.message || JSON.stringify(errorData)}`
      );
    }

    const publishInitData = await publishInitResponse.json();

    if (publishInitData.error?.code !== "ok") {
      throw new Error(`TikTok error: ${publishInitData.error?.message}`);
    }

    publishId = publishInitData.data.publish_id;
    logger.debug("TikTok publish initialized", { publishId });
  } else if (mediaUrls && mediaUrls.length > 0) {
    // Fallback to PULL_FROM_URL for backward compatibility
    const videoUrl = mediaUrls[0];
    logger.debug("Using PULL_FROM_URL for TikTok", { videoUrl });
    
    // Initialize video upload
    const initResponse = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: content.slice(0, 150), // TikTok title limit
            privacy_level: "PUBLIC_TO_EVERYONE",
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: "PULL_FROM_URL",
            video_url: videoUrl,
          },
        }),
      }
    );

    if (!initResponse.ok) {
      const error = await initResponse.json();
      throw new Error(
        `TikTok init error: ${error.error?.message || JSON.stringify(error)}`
      );
    }

    const initData = await initResponse.json();

    if (initData.error?.code !== "ok") {
      throw new Error(`TikTok error: ${initData.error?.message}`);
    }

    publishId = initData.data.publish_id;
  } else {
    throw new Error("TikTok requires a video to post. Provide either videoBuffer or mediaUrls.");
  }

  // Check publish status (TikTok processes async)
  const postId = await waitForTikTokPublish(accessToken, publishId);

  return postId;
}

async function waitForTikTokPublish(
  accessToken: string,
  publishId: string,
  maxAttempts = 60 // TikTok can take a while to process
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          publish_id: publishId,
        }),
      }
    );

    if (!response.ok) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    const data = await response.json();
    const status = data.data?.status;

    switch (status) {
      case "PUBLISH_COMPLETE":
        return data.data.publicaly_available_post_id?.[0] || publishId;

      case "FAILED":
        throw new Error(
          `TikTok publish failed: ${data.data.fail_reason || "Unknown reason"}`
        );

      case "PROCESSING_UPLOAD":
      case "PROCESSING_DOWNLOAD":
        // Still processing, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 5000));
        break;

      default:
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error("TikTok publish timeout - video may still be processing");
}

// Refresh TikTok access token
export async function refreshTikTokToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY!;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh TikTok token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
