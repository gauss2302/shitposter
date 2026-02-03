import { logger } from "@/lib/logger";
import { createOAuth1Header, parseUrl } from "./oauth1";

interface TwitterUserContext {
  accessToken: string;
  accessTokenSecret?: string; // Required for OAuth 1.0a media upload
  consumerKey?: string; // Twitter Client ID
  consumerSecret?: string; // Twitter Client Secret
}

/**
 * Upload media to Twitter and return media ID
 * Uses chunked upload for reliability with larger files
 * 
 * Uses OAuth 1.0a for media upload endpoint (required by Twitter API v1.1)
 */
export async function uploadMediaToTwitter(
  context: TwitterUserContext,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const isVideo = mimeType.startsWith("video/");
  const mediaCategory = isVideo ? "tweet_video" : "tweet_image";
  const totalBytes = fileBuffer.length;

  logger.debug("Starting Twitter media upload", { totalBytes, mimeType });

  // Check if OAuth 1.0a credentials are available
  const useOAuth1 =
    context.accessTokenSecret &&
    context.consumerKey &&
    context.consumerSecret;

  if (!useOAuth1) {
    throw new Error(
      "OAuth 1.0a credentials required for media upload. Missing: accessTokenSecret, consumerKey, or consumerSecret"
    );
  }

  // INIT phase - Initialize upload
  const initParams: Record<string, string> = {
    command: "INIT",
    total_bytes: totalBytes.toString(),
    media_type: mimeType,
    media_category: mediaCategory,
  };

  logger.debug("Twitter media INIT params", {
    total_bytes: totalBytes,
    media_type: mimeType,
    media_category: mediaCategory,
  });

  const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
  const { baseUrl, queryParams } = parseUrl(uploadUrl);

  // Create OAuth 1.0a Authorization header
  const authHeader = createOAuth1Header(
    "POST",
    baseUrl,
    { ...initParams, ...queryParams },
    {
      consumerKey: context.consumerKey!,
      consumerSecret: context.consumerSecret!,
      accessToken: context.accessToken,
      accessTokenSecret: context.accessTokenSecret!,
    }
  );

  const initResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(initParams),
  });

  logger.debug("Twitter media INIT response", { status: initResponse.status, statusText: initResponse.statusText });

  if (!initResponse.ok) {
    // Try to parse as JSON first, then fall back to text
    let errorMessage: string;
    let errorData: any = null;
    let responseText: string = "";
    
    try {
      responseText = await initResponse.text();
      logger.debug("Twitter media INIT response body", { preview: responseText.substring(0, 200) });

      if (responseText.trim()) {
        try {
          errorData = JSON.parse(responseText);
          errorMessage = 
            errorData?.errors?.[0]?.message ||
            errorData?.error ||
            errorData?.message ||
            responseText ||
            `HTTP ${initResponse.status} ${initResponse.statusText}`;
        } catch {
          errorMessage = responseText || `HTTP ${initResponse.status} ${initResponse.statusText}`;
        }
      } else {
        // Empty response - likely authentication or endpoint issue
        errorMessage = `HTTP ${initResponse.status} ${initResponse.statusText} (empty response)`;
        if (initResponse.status === 401 || initResponse.status === 403) {
          errorMessage += " - Authentication failed. Twitter media upload may require OAuth 1.0a instead of OAuth 2.0 Bearer token.";
        }
      }
    } catch (e) {
      errorMessage = `HTTP ${initResponse.status} ${initResponse.statusText} (failed to read response)`;
      logger.error("Error reading Twitter media response", e);
    }

    logger.error("Twitter media INIT error", {
      status: initResponse.status,
      statusText: initResponse.statusText,
      error: errorMessage,
      errorData,
    });
    
    throw new Error(`Failed to initialize media upload (${initResponse.status}): ${errorMessage}`);
  }

  const initData = await initResponse.json();
  const mediaId = initData.media_id_string;
  logger.debug("Twitter media upload initialized", { mediaId });

  // APPEND phase - Upload file in chunks
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks
  let segmentIndex = 0;

  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const chunk = fileBuffer.slice(
      offset,
      Math.min(offset + chunkSize, totalBytes)
    );

    logger.debug("Uploading Twitter media chunk", { segmentIndex, chunkLength: chunk.length });

    const formData = new FormData();
    formData.append("command", "APPEND");
    formData.append("media_id", mediaId);
    formData.append("segment_index", segmentIndex.toString());
    formData.append("media", new Blob([chunk], { type: mimeType }));

    // For APPEND, OAuth 1.0a signature includes only text parameters (not the file)
    // The file is sent as multipart/form-data but not included in OAuth signature
    const appendParams: Record<string, string> = {
      command: "APPEND",
      media_id: mediaId,
      segment_index: segmentIndex.toString(),
    };

    const appendAuthHeader = createOAuth1Header(
      "POST",
      baseUrl,
      { ...appendParams, ...queryParams },
      {
        consumerKey: context.consumerKey!,
        consumerSecret: context.consumerSecret!,
        accessToken: context.accessToken,
        accessTokenSecret: context.accessTokenSecret!,
      }
    );

    const appendResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: appendAuthHeader,
        // Don't set Content-Type - let fetch set it with boundary for FormData
      },
      body: formData,
    });

    if (!appendResponse.ok) {
      let errorMessage: string;
      let errorData: any = null;
      
      try {
        const responseText = await appendResponse.text();
        try {
          errorData = JSON.parse(responseText);
          errorMessage = 
            errorData?.errors?.[0]?.message ||
            errorData?.error ||
            errorData?.message ||
            responseText ||
            `HTTP ${appendResponse.status} ${appendResponse.statusText}`;
        } catch {
          errorMessage = responseText || `HTTP ${appendResponse.status} ${appendResponse.statusText}`;
        }
      } catch {
        errorMessage = `HTTP ${appendResponse.status} ${appendResponse.statusText}`;
      }

      logger.error("Twitter media APPEND error", {
        segmentIndex,
        status: appendResponse.status,
        statusText: appendResponse.statusText,
        error: errorMessage,
        errorData,
      });
      throw new Error(`Failed to upload chunk ${segmentIndex} (${appendResponse.status}): ${errorMessage}`);
    }

    logger.debug("Uploaded Twitter media chunk", { segmentIndex });
    segmentIndex++;
  }

  // FINALIZE phase - Complete upload
  logger.debug("Finalizing Twitter media upload", { mediaId });

  const finalizeParams: Record<string, string> = {
    command: "FINALIZE",
    media_id: mediaId,
  };

  const finalizeAuthHeader = createOAuth1Header(
    "POST",
    baseUrl,
    { ...finalizeParams, ...queryParams },
    {
      consumerKey: context.consumerKey!,
      consumerSecret: context.consumerSecret!,
      accessToken: context.accessToken,
      accessTokenSecret: context.accessTokenSecret!,
    }
  );

  const finalizeResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: finalizeAuthHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(finalizeParams),
  });

  if (!finalizeResponse.ok) {
    let errorMessage: string;
    let errorData: any = null;
    
    try {
      const responseText = await finalizeResponse.text();
      try {
        errorData = JSON.parse(responseText);
        errorMessage = 
          errorData?.errors?.[0]?.message ||
          errorData?.error ||
          errorData?.message ||
          responseText ||
          `HTTP ${finalizeResponse.status} ${finalizeResponse.statusText}`;
      } catch {
        errorMessage = responseText || `HTTP ${finalizeResponse.status} ${finalizeResponse.statusText}`;
      }
    } catch {
      errorMessage = `HTTP ${finalizeResponse.status} ${finalizeResponse.statusText}`;
    }

    logger.error("Twitter media FINALIZE error", {
      status: finalizeResponse.status,
      statusText: finalizeResponse.statusText,
      error: errorMessage,
      errorData,
    });
    throw new Error(`Failed to finalize media upload (${finalizeResponse.status}): ${errorMessage}`);
  }

  const finalizeData = await finalizeResponse.json();
  logger.debug("Twitter media upload finalized", { mediaId, finalizeData: !!finalizeData });

  // For videos, wait for processing
  if (isVideo && finalizeData.processing_info) {
    logger.debug("Video processing required, waiting");
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
  const statusUrl = `https://upload.twitter.com/1.1/media/upload.json?${new URLSearchParams({
    command: "STATUS",
    media_id: mediaId,
  })}`;
  const { baseUrl, queryParams } = parseUrl(statusUrl);

  for (let i = 0; i < maxAttempts; i++) {
    const statusAuthHeader = createOAuth1Header(
      "GET",
      baseUrl,
      queryParams,
      {
        consumerKey: context.consumerKey!,
        consumerSecret: context.consumerSecret!,
        accessToken: context.accessToken,
        accessTokenSecret: context.accessTokenSecret!,
      }
    );

    const response = await fetch(statusUrl, {
      headers: {
        Authorization: statusAuthHeader,
      },
    });

    if (!response.ok) {
      logger.warn("Failed to check video processing status", { mediaId });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    const data = await response.json();
    const state = data.processing_info?.state;

    logger.debug("Twitter video processing status", { state });

    if (state === "succeeded") {
      logger.debug("Twitter video processing complete", { mediaId });
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
 * 
 * @param context - Twitter OAuth 1.0a credentials (accessToken, accessTokenSecret, consumerKey, consumerSecret)
 * @param files - Array of files to upload
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

  logger.debug("Uploading multiple Twitter media files", { count: files.length });

  // Upload files sequentially (parallel might hit rate limits)
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    logger.debug("Uploading Twitter media file", { index: i + 1, total: files.length });

    try {
      const mediaId = await uploadMediaToTwitter(
        context,
        file.buffer,
        file.mimeType
      );
      mediaIds.push(mediaId);
      logger.debug("Twitter media file uploaded", { index: i + 1, mediaId });
    } catch (error) {
      logger.error("Failed to upload Twitter media file", { index: i + 1, error });
      throw error; // Don't continue if upload fails
    }
  }

  logger.debug("All Twitter media files uploaded", { count: mediaIds.length });
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
