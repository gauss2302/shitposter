import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, socialAccount } from "@/lib/db";
import { getRedis } from "@/lib/queue/connection";
import { encrypt } from "@/lib/utils";
import { createOAuth1Header, parseUrl } from "@/lib/social/oauth1";

/**
 * Step 2 & 3: Handle OAuth 1.0a callback and exchange request token for access token
 * This completes the 3-legged OAuth flow
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");
  const denied = searchParams.get("denied");

  if (denied) {
    console.error("User denied OAuth 1.0a authorization");
    redirect("/dashboard/accounts?error=oauth1_denied");
  }

  if (!oauthToken || !oauthVerifier) {
    redirect("/dashboard/accounts?error=missing_oauth1_params");
  }

  // Retrieve stored request token from Redis
  const redis = getRedis();
  let storedData: {
    userId: string;
    oauthToken: string;
    oauthTokenSecret: string;
  } | null = null;

  // Try to find the state by checking all keys (since we don't have state param in OAuth 1.0a)
  // In production, you might want to use a different approach
  const keys = await redis.keys("oauth1:twitter:*");
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (parsed.oauthToken === oauthToken) {
        storedData = parsed;
        await redis.del(key); // Clean up
        break;
      }
    }
  }

  if (!storedData) {
    console.error("Request token not found in Redis");
    redirect("/dashboard/accounts?error=oauth1_invalid_token");
  }

  const { userId, oauthTokenSecret } = storedData;

  const consumerKey = process.env.TWITTER_CLIENT_ID!;
  const consumerSecret = process.env.TWITTER_CLIENT_SECRET!;

  // Step 3: POST oauth/access_token to exchange request token for access token
  const accessTokenUrl = "https://api.x.com/oauth/access_token";
  const { baseUrl: tokenBaseUrl, queryParams } = parseUrl(accessTokenUrl);

  const accessParams: Record<string, string> = {
    oauth_verifier: oauthVerifier,
  };

  // Create OAuth 1.0a header with request token
  const authHeader = createOAuth1Header(
    "POST",
    tokenBaseUrl,
    { ...accessParams, ...queryParams },
    {
      consumerKey,
      consumerSecret,
      accessToken: oauthToken,
      accessTokenSecret: oauthTokenSecret,
    }
  );

  try {
    const response = await fetch(accessTokenUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twitter OAuth 1.0a access token error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      redirect("/dashboard/accounts?error=oauth1_access_token_failed");
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);

    const accessToken = params.get("oauth_token");
    const accessTokenSecret = params.get("oauth_token_secret");
    const userIdParam = params.get("user_id");
    const screenName = params.get("screen_name");

    if (!accessToken || !accessTokenSecret) {
      console.error("Missing oauth_token or oauth_token_secret in access token response");
      redirect("/dashboard/accounts?error=oauth1_invalid_access_token");
    }

    // Get user info using OAuth 1.0a credentials
    // We'll use account/verify_credentials to get full user info
    const verifyUrl = "https://api.x.com/1.1/account/verify_credentials.json";
    const { baseUrl: verifyBaseUrl, queryParams: verifyQueryParams } = parseUrl(verifyUrl);

    const verifyAuthHeader = createOAuth1Header(
      "GET",
      verifyBaseUrl,
      verifyQueryParams,
      {
        consumerKey,
        consumerSecret,
        accessToken,
        accessTokenSecret,
      }
    );

    const verifyResponse = await fetch(verifyUrl, {
      headers: {
        Authorization: verifyAuthHeader,
      },
    });

    let platformUserId = userIdParam || "";
    let platformUsername = screenName || "";

    if (verifyResponse.ok) {
      const userData = await verifyResponse.json();
      platformUserId = userData.id_str || platformUserId;
      platformUsername = userData.screen_name || platformUsername;
    }

    // Find existing account (might have OAuth 2.0 credentials already)
    const existingAccount = await db.query.socialAccount.findFirst({
      where: (sa, { and, eq }) =>
        and(
          eq(sa.userId, userId),
          eq(sa.platform, "twitter"),
          eq(sa.platformUserId, platformUserId)
        ),
    });

    if (existingAccount) {
      // Update existing account with OAuth 1.0a credentials
      // Keep existing OAuth 2.0 accessToken for API v2 endpoints
      // Store OAuth 1.0a credentials separately
      await db
        .update(socialAccount)
        .set({
          oauth1AccessToken: encrypt(accessToken), // Store OAuth 1.0a token
          accessTokenSecret: encrypt(accessTokenSecret), // Store OAuth 1.0a secret
          platformUsername: platformUsername,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(socialAccount.id, existingAccount.id));
    } else {
      // Create new account with OAuth 1.0a credentials
      // Note: For full functionality, user should also connect via OAuth 2.0
      // OAuth 1.0a is primarily for media upload, OAuth 2.0 for API v2 endpoints
      await db.insert(socialAccount).values({
        id: nanoid(),
        userId,
        platform: "twitter",
        platformUserId: platformUserId,
        platformUsername: platformUsername,
        accessToken: encrypt(accessToken), // OAuth 1.0a token (can be updated with OAuth 2.0 later)
        oauth1AccessToken: encrypt(accessToken), // Also store in dedicated field
        accessTokenSecret: encrypt(accessTokenSecret), // OAuth 1.0a secret
        isActive: true,
      });
    }

    redirect("/dashboard/accounts?success=oauth1_connected");
  } catch (error) {
    console.error("Error in Twitter OAuth 1.0a callback:", error);
    redirect("/dashboard/accounts?error=oauth1_callback_error");
  }
}
