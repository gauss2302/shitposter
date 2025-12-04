import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { getRedis } from "@/lib/queue/connection";

// OAuth configurations for each platform
const oauthConfigs = {
  twitter: {
    authUrl: "https://twitter.com/i/oauth2/authorize",
    clientId: process.env.TWITTER_CLIENT_ID!,
    scopes: [
      "tweet.read",
      "tweet.write",
      "users.read",
      "offline.access",
      "tweet.moderate.write",
      "follows.read",
      "follows.write",
    ],
    callbackPath: "/api/social/callback/twitter",
  },
  facebook: {
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    clientId: process.env.FACEBOOK_APP_ID!,
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_manage_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "public_profile",
    ],
    callbackPath: "/api/social/callback/facebook",
  },
  instagram: {
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    clientId: process.env.FACEBOOK_APP_ID!, // Instagram uses Facebook OAuth
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_comments",
      "instagram_manage_insights",
      "public_profile",
    ],
    callbackPath: "/api/social/callback/instagram",
  },
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    clientId: process.env.LINKEDIN_CLIENT_ID!,
    scopes: ["openid", "profile", "w_member_social", "email"],
    callbackPath: "/api/social/callback/linkedin",
  },
  tiktok: {
    authUrl: "https://www.tiktok.com/v2/auth/authorize",
    clientId: process.env.TIKTOK_CLIENT_KEY!,
    scopes: ["user.info.basic", "video.publish", "video.upload"],
    callbackPath: "/api/social/callback/tiktok",
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
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("state", state);

  // Platform-specific parameters
  if (platform === "twitter") {
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "code_challenge",
      generateCodeChallenge(codeVerifier)
    );
    authUrl.searchParams.set("code_challenge_method", "S256");
  } else if (platform === "facebook" || platform === "instagram") {
    authUrl.searchParams.set("response_type", "code");
  } else if (platform === "linkedin") {
    authUrl.searchParams.set("response_type", "code");
  } else if (platform === "tiktok") {
    authUrl.searchParams.set("response_type", "code");
  }

  redirect(authUrl.toString());
}

function generateCodeChallenge(verifier: string) {
  const hashed = createHash("sha256").update(verifier).digest("base64");
  return hashed.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
