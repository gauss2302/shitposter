import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getRedis } from "@/lib/queue/connection";
import { generateTwitterOAuth1AuthLink } from "@/lib/social/twitter-oauth1";

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

  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const callbackUrl = `${baseUrl}/api/social/callback/twitter-oauth1`;

  try {
    const authLink = await generateTwitterOAuth1AuthLink({
      callbackUrl,
      consumerKey,
      consumerSecret,
    });

    // Store request token and secret in Redis for callback verification
    const redis = getRedis();
    const state = nanoid(32);
    await redis.setex(
      `oauth1:twitter:${state}`,
      600, // 10 minutes
      JSON.stringify({
        userId: session.user.id,
        oauthToken: authLink.oauth_token,
        oauthTokenSecret: authLink.oauth_token_secret,
      })
    );

    redirect(authLink.url);
  } catch (error) {
    logger.error("Error in Twitter OAuth 1.0a request token", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("request token failed")) {
      redirect("/dashboard/accounts?error=oauth1_request_token_failed");
    }
    if (message.includes("missing oauth_token") || message.includes("oauth_callback_confirmed")) {
      redirect("/dashboard/accounts?error=oauth1_invalid_response");
    }
    redirect("/dashboard/accounts?error=oauth1_request_token_error");
  }
}
