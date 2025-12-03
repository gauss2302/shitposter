/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac } from "crypto";

interface PublishOptions {
  accessToken: string;
  content: string;
  mediaUrls?: string[];
}

/**
 * Twitter API v2 POST tweet endpoint
 * Uses OAuth 2.0 Bearer token for authentication
 */
export async function publishToTwitter({
  accessToken,
  content,
  mediaUrls,
}: PublishOptions): Promise<string> {
  const mediaIds: string[] = [];

  // Upload media first if present
  // Note: Media upload requires OAuth 1.0a, not OAuth 2.0
  // For now, we'll skip media upload if using OAuth 2.0 tokens
  // You'll need to implement OAuth 1.0a credentials for media upload
  if (mediaUrls && mediaUrls.length > 0) {
    console.warn(
      "⚠️ Media upload requires OAuth 1.0a credentials. Posting without media."
    );
    // TODO: Implement OAuth 1.0a media upload
    // mediaIds = await uploadMediaToTwitterV1(mediaUrls);
  }

  // Create tweet using v2 API
  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: content,
      ...(mediaIds.length > 0 && {
        media: { media_ids: mediaIds },
      }),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Twitter API error: ${error.detail || error.title || response.statusText}`
    );
  }

  const data = await response.json();
  return data.data.id;
}

/**
 * Upload media to Twitter using v1.1 API with OAuth 1.0a
 * This is a simplified version - for production, use chunked upload for files > 5MB
 *
 * IMPORTANT: This requires OAuth 1.0a credentials (consumer key/secret + access token/secret)
 * NOT the OAuth 2.0 Bearer token
 */
async function uploadMediaToTwitterV1Simple(
  oauthCredentials: {
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  },
  mediaUrls: string[]
): Promise<string[]> {
  const mediaIds: string[] = [];

  for (const url of mediaUrls) {
    try {
      // Download the media
      const mediaResponse = await fetch(url);
      const mediaBuffer = await mediaResponse.arrayBuffer();
      const mediaBase64 = Buffer.from(mediaBuffer).toString("base64");

      // Build OAuth 1.0a signature
      const oauth = generateOAuth1Header(
        "POST",
        "https://upload.twitter.com/1.1/media/upload.json",
        {},
        oauthCredentials
      );

      // Upload to Twitter v1.1 media endpoint
      const uploadResponse = await fetch(
        "https://upload.twitter.com/1.1/media/upload.json",
        {
          method: "POST",
          headers: {
            Authorization: oauth,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            media_data: mediaBase64,
          }),
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Failed to upload media to Twitter:", errorText);
        continue;
      }

      const uploadData = await uploadResponse.json();
      mediaIds.push(uploadData.media_id_string);
    } catch (error) {
      console.error("Error uploading media:", error);
      continue;
    }
  }

  return mediaIds;
}

/**
 * Chunked upload for larger files (recommended for files > 5MB)
 * Supports videos, GIFs, and large images
 */
async function uploadMediaToTwitterV1Chunked(
  oauthCredentials: {
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  },
  mediaUrl: string
): Promise<string | null> {
  try {
    // Download the media
    const mediaResponse = await fetch(mediaUrl);
    const mediaBuffer = await mediaResponse.arrayBuffer();
    const mediaType = mediaResponse.headers.get("content-type") || "image/jpeg";
    const totalBytes = mediaBuffer.byteLength;

    // Step 1: INIT
    const initOauth = generateOAuth1Header(
      "POST",
      "https://upload.twitter.com/1.1/media/upload.json",
      {
        command: "INIT",
        total_bytes: totalBytes.toString(),
        media_type: mediaType,
      },
      oauthCredentials
    );

    const initResponse = await fetch(
      `https://upload.twitter.com/1.1/media/upload.json?command=INIT&total_bytes=${totalBytes}&media_type=${encodeURIComponent(
        mediaType
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: initOauth,
        },
      }
    );

    if (!initResponse.ok) {
      throw new Error(`INIT failed: ${await initResponse.text()}`);
    }

    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;

    // Step 2: APPEND - Upload in chunks (max 5MB per chunk)
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const chunks = Math.ceil(totalBytes / chunkSize);

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes);
      const chunk = Buffer.from(mediaBuffer.slice(start, end));

      const appendOauth = generateOAuth1Header(
        "POST",
        "https://upload.twitter.com/1.1/media/upload.json",
        {
          command: "APPEND",
          media_id: mediaId,
          segment_index: i.toString(),
        },
        oauthCredentials
      );

      const formData = new URLSearchParams();
      formData.append("command", "APPEND");
      formData.append("media_id", mediaId);
      formData.append("segment_index", i.toString());
      formData.append("media", chunk.toString("base64"));

      const appendResponse = await fetch(
        "https://upload.twitter.com/1.1/media/upload.json",
        {
          method: "POST",
          headers: {
            Authorization: appendOauth,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        }
      );

      if (!appendResponse.ok) {
        throw new Error(
          `APPEND failed at chunk ${i}: ${await appendResponse.text()}`
        );
      }
    }

    // Step 3: FINALIZE
    const finalizeOauth = generateOAuth1Header(
      "POST",
      "https://upload.twitter.com/1.1/media/upload.json",
      {
        command: "FINALIZE",
        media_id: mediaId,
      },
      oauthCredentials
    );

    const finalizeResponse = await fetch(
      `https://upload.twitter.com/1.1/media/upload.json?command=FINALIZE&media_id=${mediaId}`,
      {
        method: "POST",
        headers: {
          Authorization: finalizeOauth,
        },
      }
    );

    if (!finalizeResponse.ok) {
      throw new Error(`FINALIZE failed: ${await finalizeResponse.text()}`);
    }

    const finalizeData = await finalizeResponse.json();

    // Step 4: Check processing status (for videos/GIFs)
    if (finalizeData.processing_info) {
      await waitForMediaProcessing(mediaId, oauthCredentials);
    }

    return mediaId;
  } catch (error) {
    console.error("Chunked upload error:", error);
    return null;
  }
}

/**
 * Wait for media processing to complete (for videos/GIFs)
 */
async function waitForMediaProcessing(
  mediaId: string,
  oauthCredentials: {
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  },
  maxAttempts = 30
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const statusOauth = generateOAuth1Header(
      "GET",
      "https://upload.twitter.com/1.1/media/upload.json",
      {
        command: "STATUS",
        media_id: mediaId,
      },
      oauthCredentials
    );

    const response = await fetch(
      `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
      {
        method: "GET",
        headers: {
          Authorization: statusOauth,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const state = data.processing_info?.state;

      if (state === "succeeded") return;
      if (state === "failed") throw new Error("Media processing failed");

      // Wait before checking again
      const checkAfterSecs = data.processing_info?.check_after_secs || 2;
      await new Promise((resolve) =>
        setTimeout(resolve, checkAfterSecs * 1000)
      );
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Media processing timeout");
}

/**
 * Generate OAuth 1.0a authorization header
 * Required for v1.1 API endpoints
 */
function generateOAuth1Header(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: {
    consumerKey: string;
    consumerSecret: string;
    accessToken: string;
    accessTokenSecret: string;
  }
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Buffer.from(Math.random().toString()).toString("base64");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
  };

  // Combine OAuth params with request params
  const allParams: Record<string, string> = { ...oauthParams, ...params };

  // Create signature base string
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`
    )
    .join("&");

  const signatureBase = `${method.toUpperCase()}&${encodeURIComponent(
    url
  )}&${encodeURIComponent(paramString)}`;

  // Create signing key
  const signingKey = `${encodeURIComponent(
    credentials.consumerSecret
  )}&${encodeURIComponent(credentials.accessTokenSecret)}`;

  // Generate signature
  const signature = createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  // Build authorization header
  const authParams: Record<string, string> = {
    ...oauthParams,
    oauth_signature: signature,
  };

  const authHeader =
    "OAuth " +
    Object.keys(authParams)
      .map(
        (key) =>
          `${encodeURIComponent(key)}="${encodeURIComponent(authParams[key])}"`
      )
      .join(", ");

  return authHeader;
}

/**
 * Refresh Twitter OAuth 2.0 access token
 */
export async function refreshTwitterToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Twitter token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
