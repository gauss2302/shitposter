interface PublishOptions {
  accessToken: string;
  accountId: string; // LinkedIn person URN or organization URN
  content: string;
  mediaUrls?: string[];
}

export async function publishToLinkedIn({
  accessToken,
  accountId,
  content,
  mediaUrls,
}: PublishOptions): Promise<string> {
  const authorUrn = `urn:li:person:${accountId}`;

  // Prepare media assets if present
  let mediaAssets: string[] = [];
  if (mediaUrls && mediaUrls.length > 0) {
    mediaAssets = await uploadMediaToLinkedIn(
      accessToken,
      authorUrn,
      mediaUrls
    );
  }

  // Create the post
  const postBody: LinkedInPostBody = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: mediaAssets.length > 0 ? "IMAGE" : "NONE",
        ...(mediaAssets.length > 0 && {
          media: mediaAssets.map((asset) => ({
            status: "READY",
            media: asset,
          })),
        }),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(postBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `LinkedIn API error: ${error.message || JSON.stringify(error)}`
    );
  }

  // LinkedIn returns the post ID in the x-restli-id header
  const postId = response.headers.get("x-restli-id");

  if (!postId) {
    const data = await response.json();
    return data.id || "unknown";
  }

  return postId;
}

async function uploadMediaToLinkedIn(
  accessToken: string,
  ownerUrn: string,
  mediaUrls: string[]
): Promise<string[]> {
  const assets: string[] = [];

  for (const url of mediaUrls.slice(0, 20)) {
    try {
      // Step 1: Register upload
      const registerResponse = await fetch(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: ownerUrn,
              serviceRelationships: [
                {
                  relationshipType: "OWNER",
                  identifier: "urn:li:userGeneratedContent",
                },
              ],
            },
          }),
        }
      );

      if (!registerResponse.ok) {
        console.error("Failed to register LinkedIn upload");
        continue;
      }

      const registerData = await registerResponse.json();
      const uploadUrl =
        registerData.value.uploadMechanism[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ].uploadUrl;
      const asset = registerData.value.asset;

      // Step 2: Download the image
      const imageResponse = await fetch(url);
      const imageBuffer = await imageResponse.arrayBuffer();

      // Step 3: Upload to LinkedIn
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type":
            imageResponse.headers.get("content-type") || "image/jpeg",
        },
        body: imageBuffer,
      });

      if (uploadResponse.ok) {
        assets.push(asset);
      } else {
        console.error("Failed to upload image to LinkedIn");
      }
    } catch (error) {
      console.error("Error uploading media to LinkedIn:", error);
    }
  }

  return assets;
}

interface LinkedInPostBody {
  author: string;
  lifecycleState: string;
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary: {
        text: string;
      };
      shareMediaCategory: string;
      media?: Array<{
        status: string;
        media: string;
      }>;
    };
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": string;
  };
}

// Refresh LinkedIn access token
export async function refreshLinkedInToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;

  const response = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh LinkedIn token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
