interface PublishOptions {
  accessToken: string;
  content: string;
  mediaUrls?: string[];
}

export async function publishToTwitter({
  accessToken,
  content,
  mediaUrls,
}: PublishOptions): Promise<string> {
  // Upload media first if present
  let mediaIds: string[] = [];

  if (mediaUrls && mediaUrls.length > 0) {
    mediaIds = await uploadMediaToTwitter(accessToken, mediaUrls);
  }

  // Create tweet
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

async function uploadMediaToTwitter(
  accessToken: string,
  mediaUrls: string[]
): Promise<string[]> {
  const mediaIds: string[] = [];

  for (const url of mediaUrls) {
    // Download the media
    const mediaResponse = await fetch(url);
    const mediaBuffer = await mediaResponse.arrayBuffer();
    const mediaBase64 = Buffer.from(mediaBuffer).toString("base64");

    // Determine media type
    const contentType =
      mediaResponse.headers.get("content-type") || "image/jpeg";

    // Upload to Twitter (using v1.1 media upload endpoint)
    // Note: Twitter API v2 doesn't have media upload, must use v1.1
    const uploadResponse = await fetch(
      "https://upload.twitter.com/1.1/media/upload.json",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          media_data: mediaBase64,
        }),
      }
    );

    if (!uploadResponse.ok) {
      console.error("Failed to upload media to Twitter");
      continue;
    }

    const uploadData = await uploadResponse.json();
    mediaIds.push(uploadData.media_id_string);
  }

  return mediaIds;
}

// Refresh Twitter access token
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
