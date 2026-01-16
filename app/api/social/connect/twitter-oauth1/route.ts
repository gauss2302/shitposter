import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/queue/connection";
import { createOAuth1Header, parseUrl } from "@/lib/social/oauth1";

/**
 * Step 1: Request OAuth 1.0a request token from Twitter
 * This initiates the 3-legged OAuth flow for obtaining access tokens
 */
export async function GET(request: NextRequest) {
  // Verify user is authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const consumerKey = process.env.TWITTER_CLIENT_ID!;
  const consumerSecret = process.env.TWITTER_CLIENT_SECRET!;

  if (!consumerKey || !consumerSecret) {
    throw new Error("TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set");
  }

  // Build callback URL
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const callbackUrl = `${baseUrl}/api/social/callback/twitter-oauth1`;

  // Step 1: POST oauth/request_token
  const requestTokenUrl = "https://api.x.com/oauth/request_token";
  const { baseUrl: tokenBaseUrl, queryParams } = parseUrl(requestTokenUrl);

  // OAuth 1.0a parameters for request token
  const requestParams: Record<string, string> = {
    oauth_callback: callbackUrl,
  };

  // Create OAuth 1.0a header (no token yet, only consumer credentials)
  const authHeader = createOAuth1Header(
    "POST",
    tokenBaseUrl,
    { ...requestParams, ...queryParams },
    {
      consumerKey,
      consumerSecret,
      accessToken: "", // Empty for request token
      accessTokenSecret: "", // Empty for request token
    }
  );

  try {
    const response = await fetch(requestTokenUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twitter OAuth 1.0a request token error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      redirect("/dashboard/accounts?error=oauth1_request_token_failed");
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);

    const oauthToken = params.get("oauth_token");
    const oauthTokenSecret = params.get("oauth_token_secret");
    const oauthCallbackConfirmed = params.get("oauth_callback_confirmed");

    if (!oauthToken || !oauthTokenSecret) {
      console.error("Missing oauth_token or oauth_token_secret in response");
      redirect("/dashboard/accounts?error=oauth1_invalid_response");
    }

    if (oauthCallbackConfirmed !== "true") {
      console.error("oauth_callback_confirmed is not true");
      redirect("/dashboard/accounts?error=oauth1_callback_not_confirmed");
    }

    // Store request token and secret in Redis for callback verification
    const redis = getRedis();
    const state = nanoid(32);
    await redis.setex(
      `oauth1:twitter:${state}`,
      600, // 10 minutes
      JSON.stringify({
        userId: session.user.id,
        oauthToken,
        oauthTokenSecret,
      })
    );

    // Step 2: Redirect user to Twitter authorization page
    const authorizeUrl = `https://api.x.com/oauth/authorize?oauth_token=${encodeURIComponent(oauthToken)}`;
    redirect(authorizeUrl);
  } catch (error) {
    console.error("Error in Twitter OAuth 1.0a request token:", error);
    redirect("/dashboard/accounts?error=oauth1_request_token_error");
  }
}
