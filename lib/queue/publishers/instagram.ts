interface PublishOptions {
  accessToken: string;
  content: string;
  mediaUrls?: string[];
}

// Instagram requires media for posts (no text-only posts)
// Uses Facebook Graph API for Instagram Business/Creator accounts
export async function publishToInstagram({
  accessToken,
  content,
  mediaUrls,
}: PublishOptions): Promise<string> {
  if (!mediaUrls || mediaUrls.length === 0) {
    throw new Error("Instagram requires at least one image or video");
  }

  // Get Instagram Business Account ID
  const accountId = await getInstagramAccountId(accessToken);

  if (mediaUrls.length === 1) {
    // Single media post
    return publishSingleMedia(accessToken, accountId, content, mediaUrls[0]);
  } else {
    // Carousel post (multiple images)
    return publishCarousel(accessToken, accountId, content, mediaUrls);
  }
}

async function getInstagramAccountId(accessToken: string): Promise<string> {
  // Get pages connected to this user
  const pagesResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
  );

  if (!pagesResponse.ok) {
    throw new Error("Failed to get Facebook pages");
  }

  const pagesData = await pagesResponse.json();
  const page = pagesData.data?.[0];

  if (!page) {
    throw new Error(
      "No Facebook page found. Instagram Business account requires a connected Facebook page."
    );
  }

  // Get Instagram account connected to this page
  const igResponse = await fetch(
    `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`
  );

  if (!igResponse.ok) {
    throw new Error("Failed to get Instagram business account");
  }

  const igData = await igResponse.json();

  if (!igData.instagram_business_account?.id) {
    throw new Error(
      "No Instagram Business account connected to this Facebook page"
    );
  }

  return igData.instagram_business_account.id;
}

async function publishSingleMedia(
  accessToken: string,
  accountId: string,
  caption: string,
  mediaUrl: string
): Promise<string> {
  // Step 1: Create media container
  const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);

  const containerResponse = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        caption,
        ...(isVideo
          ? { video_url: mediaUrl, media_type: "VIDEO" }
          : { image_url: mediaUrl }),
      }),
    }
  );

  if (!containerResponse.ok) {
    const error = await containerResponse.json();
    throw new Error(
      `Failed to create media container: ${error.error?.message}`
    );
  }

  const containerData = await containerResponse.json();
  const containerId = containerData.id;

  // Step 2: Wait for media to be ready (for videos)
  if (isVideo) {
    await waitForMediaReady(accessToken, containerId);
  }

  // Step 3: Publish the container
  const publishResponse = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        creation_id: containerId,
      }),
    }
  );

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    throw new Error(`Failed to publish: ${error.error?.message}`);
  }

  const publishData = await publishResponse.json();
  return publishData.id;
}

async function publishCarousel(
  accessToken: string,
  accountId: string,
  caption: string,
  mediaUrls: string[]
): Promise<string> {
  // Step 1: Create containers for each media item
  const containerIds: string[] = [];

  for (const url of mediaUrls.slice(0, 10)) {
    // Max 10 items
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          image_url: url,
          is_carousel_item: true,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      containerIds.push(data.id);
    }
  }

  if (containerIds.length === 0) {
    throw new Error("Failed to create any media containers");
  }

  // Step 2: Create carousel container
  const carouselResponse = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        caption,
        media_type: "CAROUSEL",
        children: containerIds,
      }),
    }
  );

  if (!carouselResponse.ok) {
    const error = await carouselResponse.json();
    throw new Error(`Failed to create carousel: ${error.error?.message}`);
  }

  const carouselData = await carouselResponse.json();

  // Step 3: Publish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v18.0/${accountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        creation_id: carouselData.id,
      }),
    }
  );

  if (!publishResponse.ok) {
    const error = await publishResponse.json();
    throw new Error(`Failed to publish carousel: ${error.error?.message}`);
  }

  const publishData = await publishResponse.json();
  return publishData.id;
}

async function waitForMediaReady(
  accessToken: string,
  containerId: string,
  maxAttempts = 30
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );

    if (response.ok) {
      const data = await response.json();
      if (data.status_code === "FINISHED") return;
      if (data.status_code === "ERROR") {
        throw new Error("Media processing failed");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Media processing timeout");
}
