import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, socialAccount } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getRedis } from "@/lib/queue/connection";
import { encrypt } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  logger.debug("OAuth callback", { platform, hasCode: !!code, hasState: !!state, error, errorDescription });

  if (error) {
    logger.error("OAuth error", { platform, error, errorDescription });
    redirect("/dashboard/accounts?error=oauth_denied");
  }

  if (!code || !state) {
    logger.error("Missing OAuth parameters", { platform, hasCode: !!code, hasState: !!state });
    redirect("/dashboard/accounts?error=missing_params");
  }

  // Retrieve stored state from Redis
  const redis = getRedis();
  const storedData = await redis.get(`oauth:${platform}:${state}`);

  if (!storedData) {
    redirect("/dashboard/accounts?error=invalid_state");
  }

  let userId: string;
  let codeVerifier: string;
  try {
    const parsed = JSON.parse(storedData) as { userId: string; codeVerifier: string };
    if (typeof parsed?.userId !== "string" || typeof parsed?.codeVerifier !== "string") {
      throw new Error("Invalid stored state shape");
    }
    userId = parsed.userId;
    codeVerifier = parsed.codeVerifier;
  } catch {
    logger.error("Invalid OAuth state data in Redis", { platform, state: state?.slice(0, 8) });
    redirect("/dashboard/accounts?error=invalid_state");
  }

  // Delete the state from Redis
  await redis.del(`oauth:${platform}:${state}`);

  try {
    let tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    };
    let platformUser: {
      id: string;
      username: string;
      profileImageUrl?: string;
    };

    // Exchange code for tokens based on platform
    switch (platform) {
      case "twitter":
        const twitterResult = await exchangeTwitterCode(code, codeVerifier);
        tokens = twitterResult.tokens;
        platformUser = twitterResult.user;
        break;

      case "linkedin":
        const linkedinResult = await exchangeLinkedInCode(code);
        tokens = linkedinResult.tokens;
        platformUser = linkedinResult.user;
        break;

      // Add other platforms here
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    // Save to database
    const existingAccount = await db.query.socialAccount.findFirst({
      where: (sa, { and, eq }) =>
        and(
          eq(sa.userId, userId),
          eq(sa.platform, platform),
          eq(sa.platformUserId, platformUser.id)
        ),
    });

    if (existingAccount) {
      // Update existing account
      await db
        .update(socialAccount)
        .set({
          accessToken: encrypt(tokens.accessToken),
          refreshToken: tokens.refreshToken
            ? encrypt(tokens.refreshToken)
            : null,
          tokenExpiresAt: tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000)
            : null,
          platformUsername: platformUser.username,
          profileImageUrl: platformUser.profileImageUrl,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(socialAccount.id, existingAccount.id));
    } else {
      // Create new account
      await db.insert(socialAccount).values({
        id: nanoid(),
        userId,
        platform,
        platformUserId: platformUser.id,
        platformUsername: platformUser.username,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
        tokenExpiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : null,
        profileImageUrl: platformUser.profileImageUrl,
        isActive: true,
      });
    }

    redirect("/dashboard/accounts?success=connected");
  } catch (err) {
    logger.error("Error connecting platform", { platform, err });
    redirect("/dashboard/accounts?error=connection_failed");
  }
}

// Twitter token exchange
async function exchangeTwitterCode(code: string, codeVerifier: string) {
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/social/callback/twitter`;

  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

  // Exchange code for tokens
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const error = await tokenRes.text();
    throw new Error(`Twitter token error: ${error}`);
  }

  const tokenData = await tokenRes.json();

  // Get user info
  const userRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    }
  );

  if (!userRes.ok) {
    throw new Error("Failed to get Twitter user info");
  }

  const userData = await userRes.json();

  return {
    tokens: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
    },
    user: {
      id: userData.data.id,
      username: userData.data.username,
      profileImageUrl: userData.data.profile_image_url,
    },
  };
}

// LinkedIn token exchange
async function exchangeLinkedInCode(code: string) {
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/social/callback/linkedin`;

  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn credentials are not configured");
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    let errorMessage = `LinkedIn token exchange failed (${tokenRes.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    logger.error("LinkedIn token error", {
      status: tokenRes.status,
      statusText: tokenRes.statusText,
      error: errorMessage,
    });
    throw new Error(errorMessage);
  }

  const tokenData = await tokenRes.json();
  
  if (!tokenData.access_token) {
    throw new Error("LinkedIn did not return an access token");
  }

  // Get user info using OpenID Connect
  const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userRes.ok) {
    logger.debug("OpenID Connect failed, falling back to legacy API");
    // Fallback to legacy API if OpenID Connect fails
    const profileRes = await fetch("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileRes.ok) {
      const errorText = await profileRes.text();
      logger.error("LinkedIn profile API error", {
        status: profileRes.status,
        statusText: profileRes.statusText,
        error: errorText,
      });
      throw new Error(`Failed to get LinkedIn user info: ${profileRes.status} ${profileRes.statusText}`);
    }

    const profileData = await profileRes.json();
    
    if (!profileData.id) {
      throw new Error("LinkedIn profile data is missing user ID");
    }
    
    // Get profile picture
    const pictureRes = await fetch(
      "https://api.linkedin.com/v2/me?projection=(id,profilePicture(displayImage~:playableStreams))",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    let profileImageUrl: string | undefined;
    if (pictureRes.ok) {
      const pictureData = await pictureRes.json();
      const displayImage = pictureData.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]?.identifier;
      profileImageUrl = displayImage;
    }

    return {
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresIn: tokenData.expires_in || 5184000, // Default 60 days
      },
      user: {
        id: profileData.id,
        username: profileData.localizedFirstName || profileData.firstName?.localized?.en_US || "LinkedIn User",
        profileImageUrl,
      },
    };
  }

  const userData = await userRes.json();

  return {
    tokens: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresIn: tokenData.expires_in || 5184000, // Default 60 days
    },
    user: {
      id: userData.sub || userData.id,
      username: userData.name || userData.given_name || "LinkedIn User",
      profileImageUrl: userData.picture,
    },
  };
}
