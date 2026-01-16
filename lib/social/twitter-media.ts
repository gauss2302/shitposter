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

  console.log(`📤 Starting upload: ${totalBytes} bytes, type: ${mimeType}`);

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

  console.log(`📤 INIT request params:`, {
    command: "INIT",
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

  console.log(`📤 INIT response status: ${initResponse.status} ${initResponse.statusText}`);

  if (!initResponse.ok) {
    // Try to parse as JSON first, then fall back to text
    let errorMessage: string;
    let errorData: any = null;
    let responseText: string = "";
    
    try {
      responseText = await initResponse.text();
      console.log(`📤 INIT response body:`, responseText.substring(0, 500)); // Log first 500 chars
      
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
      console.error("Error reading response:", e);
    }

    console.error("Twitter media INIT error:", {
      status: initResponse.status,
      statusText: initResponse.statusText,
      headers: Object.fromEntries(initResponse.headers.entries()),
      error: errorMessage,
      errorData,
      responsePreview: responseText.substring(0, 200),
    });
    
    throw new Error(`Failed to initialize media upload (${initResponse.status}): ${errorMessage}`);
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

      console.error(
        `Twitter media APPEND error (chunk ${segmentIndex}):`,
        {
          status: appendResponse.status,
          statusText: appendResponse.statusText,
          error: errorMessage,
          errorData,
        }
      );
      throw new Error(`Failed to upload chunk ${segmentIndex} (${appendResponse.status}): ${errorMessage}`);
    }

    console.log(`✅ Uploaded chunk ${segmentIndex}`);
    segmentIndex++;
  }

  // FINALIZE phase - Complete upload
  console.log(`🏁 Finalizing upload for media_id: ${mediaId}`);

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

    console.error("Twitter media FINALIZE error:", {
      status: finalizeResponse.status,
      statusText: finalizeResponse.statusText,
      error: errorMessage,
      errorData,
    });
    throw new Error(`Failed to finalize media upload (${finalizeResponse.status}): ${errorMessage}`);
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
