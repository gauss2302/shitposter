import { logger } from "@/lib/logger";

interface MediaFile {
  buffer: Buffer;
  mimeType: string;
}

interface PublishOptions {
  accessToken: string;
  accountId: string; // LinkedIn person URN or organization URN
  content: string;
  mediaFiles?: MediaFile[]; // Direct binary data
  mediaUrls?: string[]; // Legacy: URLs (will be downloaded)
}

export async function publishToLinkedIn({
  accessToken,
  accountId,
  content,
  mediaFiles,
  mediaUrls,
}: PublishOptions): Promise<string> {
  const authorUrn = `urn:li:person:${accountId}`;

  // Prepare media assets if present
  let mediaAssets: string[] = [];
  if (mediaFiles && mediaFiles.length > 0) {
    // Upload from binary data (preferred)
    mediaAssets = await uploadMediaFromBuffers(
      accessToken,
      authorUrn,
      mediaFiles
    );
  } else if (mediaUrls && mediaUrls.length > 0) {
    // Legacy: download from URLs and upload
    mediaAssets = await uploadMediaFromUrls(
      accessToken,
      authorUrn,
      mediaUrls
    );
  }

  logger.debug("Creating LinkedIn post", { mediaCount: mediaAssets.length, mediaUrns: mediaAssets });

  // Determine shareMediaCategory based on uploaded assets
  let shareMediaCategory: "NONE" | "IMAGE" | "VIDEO" = "NONE";
  if (mediaAssets.length > 0) {
    // Check if any asset is a video (videos have different URN format)
    const hasVideo = mediaAssets.some(asset => 
      asset.includes("feedshare-video") || asset.includes("video")
    );
    shareMediaCategory = hasVideo ? "VIDEO" : "IMAGE";
  }

  // Build post body using UGC Posts API (v2) as per official documentation
  // Reference: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
  const postBody: LinkedInUgcPostBody = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory,
        ...(mediaAssets.length > 0 && {
          media: mediaAssets.map((assetUrn) => ({
            status: "READY",
            media: assetUrn,
          })),
        }),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  logger.debug("Posting to LinkedIn UGC Posts API", { shareMediaCategory });

  // Use UGC Posts API endpoint as per official documentation
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
    let errorMessage = `LinkedIn API error (${response.status} ${response.statusText})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || 
                     errorData.error?.message || 
                     JSON.stringify(errorData);
      logger.error("LinkedIn post creation error", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
    } catch (e) {
      const errorText = await response.text();
      logger.error("LinkedIn post creation error (non-JSON)", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  // LinkedIn returns the post ID in the X-RestLi-Id header
  const postId = response.headers.get("x-restli-id");

  if (!postId) {
    try {
    const data = await response.json();
      const id = data.id || data.value?.id || "unknown";
      logger.debug("LinkedIn post created", { id });
      return id;
    } catch (e) {
      logger.warn("Could not parse LinkedIn post response, using 'unknown'");
      return "unknown";
    }
  }

  logger.debug("LinkedIn post created", { postId });
  return postId;
}

// Upload media from Buffer data using /v2/assets endpoint
async function uploadMediaFromBuffers(
  accessToken: string,
  ownerUrn: string,
  mediaFiles: MediaFile[]
): Promise<string[]> {
  const assets: string[] = [];
  const maxMedia = 9; // LinkedIn allows up to 9 images/videos per post
  const filesToUpload = mediaFiles.slice(0, maxMedia);

  logger.debug("Uploading media to LinkedIn", { count: filesToUpload.length });

  for (let i = 0; i < filesToUpload.length; i++) {
    const mediaFile = filesToUpload[i];
    const fileNum = i + 1;
    
    try {
      const isVideo = mediaFile.mimeType.startsWith("video/");
      const isImage = mediaFile.mimeType.startsWith("image/");
      
      logger.debug("Processing LinkedIn media file", { fileNum, total: filesToUpload.length, mimeType: mediaFile.mimeType });

      if (isVideo) {
        // Upload video using /v2/assets with feedshare-video recipe
        const videoAsset = await uploadVideoToLinkedIn(
          accessToken,
          ownerUrn,
          mediaFile.buffer,
          mediaFile.mimeType
        );
        if (videoAsset) {
          assets.push(videoAsset);
          logger.debug("LinkedIn file uploaded", { fileNum, asset: videoAsset });
        } else {
          logger.error("LinkedIn file upload failed", { fileNum });
        }
      } else if (isImage) {
        // Upload image using /v2/assets with feedshare-image recipe
        const imageAsset = await uploadImageToLinkedIn(
          accessToken,
          ownerUrn,
          mediaFile.buffer,
          mediaFile.mimeType
        );
        if (imageAsset) {
          assets.push(imageAsset);
          logger.debug("LinkedIn file uploaded", { fileNum, asset: imageAsset });
        } else {
          logger.error("LinkedIn file upload failed", { fileNum });
        }
      } else {
        logger.warn("Unsupported media type for LinkedIn", { fileNum, mimeType: mediaFile.mimeType });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Error uploading file to LinkedIn", {
        fileNum,
        error: errorMessage,
        mimeType: mediaFile.mimeType,
        fileSize: mediaFile.buffer.length,
      });
    }
  }

  logger.debug("LinkedIn upload summary", { uploaded: assets.length, total: filesToUpload.length });
  return assets;
}

// Upload image using /v2/assets endpoint as per official documentation
// Reference: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
async function uploadImageToLinkedIn(
  accessToken: string,
  ownerUrn: string,
  imageBuffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const fileSize = imageBuffer.length;
  logger.debug("Registering LinkedIn image upload", { fileSize, mimeType });

  try {
    // Step 1: Register upload using /v2/assets?action=registerUpload
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
      let errorMessage = `Failed to register image upload (${registerResponse.status})`;
      try {
        const errorData = await registerResponse.json();
        errorMessage = errorData.message || errorData.error?.message || JSON.stringify(errorData);
        logger.error("LinkedIn image register error", {
          status: registerResponse.status,
          statusText: registerResponse.statusText,
          error: errorData,
        });
      } catch (e) {
        const errorText = await registerResponse.text();
        logger.error("LinkedIn image register error (non-JSON)", {
          status: registerResponse.status,
          statusText: registerResponse.statusText,
          error: errorText,
        });
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
      }

      const registerData = await registerResponse.json();
    logger.debug("LinkedIn register upload response", { hasValue: !!registerData.value });

    // Extract uploadUrl and asset from response
    const uploadUrl = registerData.value?.uploadMechanism?.[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
      logger.error("Invalid response from LinkedIn register upload", {
        hasUploadUrl: !!uploadUrl,
        hasAsset: !!asset,
      });
      throw new Error("LinkedIn did not return uploadUrl or asset URN");
    }

    logger.debug("Uploading image binary to LinkedIn", { asset });

    // Step 2: Upload binary image data using PUT (as per curl example with --upload-file)
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      let errorMessage = `Failed to upload image binary (${uploadResponse.status})`;
      try {
        const errorData = await uploadResponse.json();
        errorMessage = errorData.message || errorData.error?.message || JSON.stringify(errorData);
        logger.error("LinkedIn image upload error", {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorData,
          asset,
        });
      } catch (e) {
        const errorText = await uploadResponse.text();
        logger.error("LinkedIn image upload error (non-JSON)", {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorText,
        });
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    logger.debug("Image uploaded to LinkedIn", { asset });

    // Return the asset URN (urn:li:digitalmediaAsset:...)
    // This will be used in the ugcPosts API call
    return asset;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error uploading image to LinkedIn", {
      error: errorMessage,
      fileSize,
      mimeType,
    });
    return null;
  }
}

// Upload video using /v2/assets endpoint as per official documentation
// Reference: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
async function uploadVideoToLinkedIn(
  accessToken: string,
  ownerUrn: string,
  videoBuffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const fileSize = videoBuffer.length;
  logger.debug("Registering LinkedIn video upload", { fileSize, mimeType });

  try {
    // Step 1: Register upload using /v2/assets?action=registerUpload with feedshare-video recipe
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
            recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
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
      let errorMessage = `Failed to register video upload (${registerResponse.status})`;
      try {
        const errorData = await registerResponse.json();
        errorMessage = errorData.message || errorData.error?.message || JSON.stringify(errorData);
        logger.error("LinkedIn video register error", {
          status: registerResponse.status,
          statusText: registerResponse.statusText,
          error: errorData,
        });
      } catch (e) {
        const errorText = await registerResponse.text();
        logger.error("LinkedIn video register error (non-JSON)", {
          status: registerResponse.status,
          statusText: registerResponse.statusText,
          error: errorText,
        });
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const registerData = await registerResponse.json();
    logger.debug("LinkedIn register video upload response", { hasValue: !!registerData.value });

    // Extract uploadUrl and asset from response
    const uploadUrl = registerData.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
    const asset = registerData.value?.asset;

    if (!uploadUrl || !asset) {
      logger.error("Invalid response from LinkedIn register video upload", {
        hasUploadUrl: !!uploadUrl,
        hasAsset: !!asset,
      });
      throw new Error("LinkedIn did not return uploadUrl or asset URN");
    }

    logger.debug("Uploading video binary to LinkedIn", { asset });

    // Step 2: Upload video binary data using PUT
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      let errorMessage = `Failed to upload video binary (${uploadResponse.status})`;
      try {
        const errorData = await uploadResponse.json();
        errorMessage = errorData.message || errorData.error?.message || JSON.stringify(errorData);
        logger.error("LinkedIn video upload error", {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorData,
          asset,
        });
      } catch (e) {
        const errorText = await uploadResponse.text();
        logger.error("LinkedIn video upload error (non-JSON)", {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorText,
        });
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    logger.debug("Video uploaded to LinkedIn", { asset });

    // Return the asset URN (urn:li:digitalmediaAsset:...)
    // This will be used in the ugcPosts API call
    return asset;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error uploading video to LinkedIn", {
      error: errorMessage,
      fileSize,
      mimeType,
    });
    return null;
  }
}

// Legacy: Upload media from URLs (downloads first, then uploads using /v2/assets API)
async function uploadMediaFromUrls(
  accessToken: string,
  ownerUrn: string,
  mediaUrls: string[]
): Promise<string[]> {
  const assets: string[] = [];

  for (const url of mediaUrls.slice(0, 9)) {
    try {
      // Step 1: Download the image first
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) {
        logger.error("Failed to download image from URL", { url, status: imageResponse.status });
        continue;
      }
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      const imageBuffer = Buffer.from(imageArrayBuffer);
      const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

      // Step 2: Use the uploadImageToLinkedIn function (which uses /v2/assets API)
      const imageUrn = await uploadImageToLinkedIn(
        accessToken,
        ownerUrn,
        imageBuffer,
        mimeType
      );

      if (imageUrn) {
        assets.push(imageUrn);
      } else {
        logger.error("Failed to upload image from URL", { url });
      }
    } catch (error) {
      logger.error("Error uploading media to LinkedIn", error);
    }
  }

  return assets;
}

// UGC Post Body format as per official documentation
interface LinkedInUgcPostBody {
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
        description?: { text: string };
        title?: { text: string };
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
