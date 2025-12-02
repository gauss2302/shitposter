import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/queue/connection";

// OAuth configurations for each platform
const oauthConfigs = {
  twitter: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    clientId: process.env.TWITTER_CLIENT_ID!,
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    callbackPath: "/api/social/callback/twitter",
  },
  // Add other platforms here
  instagram: {
    authUrl: "https://api.instagram.com/oauth/authorize",
    clientId: process.env.INSTAGRAM_APP_ID!,
    scopes: ["user_profile", "user_media"],
    callbackPath: "/api/social/callback/instagram",
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  // Verify user is authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const config = oauthConfigs[platform as keyof typeof oauthConfigs];
  if (!config) {
    return new Response(`Unknown platform: ${platform}`, { status: 400 });
  }

  // Generate state and PKCE verifier
  const state = nanoid(32);
  const codeVerifier = nanoid(64);

  // Store in Redis for callback verification (expires in 10 min)
  const redis = getRedis();
  await redis.setex(
    `oauth:${platform}:${state}`,
    600,
    JSON.stringify({
      userId: session.user.id,
      codeVerifier,
    })
  );

  // Build authorization URL
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}${config.callbackPath}`;

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("state", state);

  // PKCE for Twitter
  if (platform === "twitter") {
    authUrl.searchParams.set("code_challenge", codeVerifier);
    authUrl.searchParams.set("code_challenge_method", "plain");
  }

  redirect(authUrl.toString());
}
