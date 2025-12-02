import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { db, socialAccount } from "@/lib/db";
import { getRedis } from "@/lib/queue/connection";

// Simple encryption (in production, use a proper encryption library)
function encrypt(text: string): string {
  // TODO: Implement proper encryption using crypto
  return Buffer.from(text).toString("base64");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error(`OAuth error for ${platform}:`, error);
    redirect("/dashboard/accounts?error=oauth_denied");
  }

  if (!code || !state) {
    redirect("/dashboard/accounts?error=missing_params");
  }

  // Retrieve stored state from Redis
  const redis = getRedis();
  const storedData = await redis.get(`oauth:${platform}:${state}`);

  if (!storedData) {
    redirect("/dashboard/accounts?error=invalid_state");
  }

  const { userId, codeVerifier } = JSON.parse(storedData);

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
        .where((sa, { eq }) => eq(sa.id, existingAccount.id));
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
    console.error(`Error connecting ${platform}:`, err);
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
