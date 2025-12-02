interface PublishOptions {
  accessToken: string;
  content: string;
  mediaUrls?: string[];
}

// TikTok Content Posting API
// Note: TikTok requires video content - no text-only or image posts
export async function publishToTikTok({
  accessToken,
  content,
  mediaUrls,
}: PublishOptions): Promise<string> {
  if (!mediaUrls || mediaUrls.length === 0) {
    throw new Error("TikTok requires a video to post");
  }

  const videoUrl = mediaUrls[0];

  // Step 1: Initialize video upload
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

  const publishId = initData.data.publish_id;

  // Step 2: Check publish status (TikTok processes async)
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
