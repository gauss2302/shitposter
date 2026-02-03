// app/api/analytics/twitter/[accountId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { logger } from "@/lib/logger";
import { and, eq } from "drizzle-orm";
import { decrypt } from "@/lib/utils";
import { getTwitterAnalytics } from "@/lib/social/twitter";
import { getRedis } from "@/lib/queue/connection";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  // Verify user is authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the social account
    const account = await db.query.socialAccount.findFirst({
      where: and(
        eq(socialAccount.id, accountId),
        eq(socialAccount.userId, session.user.id),
        eq(socialAccount.platform, "twitter")
      ),
    });

    if (!account) {
      return NextResponse.json(
        { error: "Twitter account not found" },
        { status: 404 }
      );
    }

    if (!account.isActive) {
      return NextResponse.json(
        { error: "Twitter account is not active. Please reconnect." },
        { status: 400 }
      );
    }

    // Get tweet limit from query params (default 50)
    const tweetLimit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "50"),
      100
    );

    // Check cache first (to avoid rate limits)
    const redis = getRedis();
    const cacheKey = `twitter:analytics:${accountId}:${tweetLimit}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug("Returning cached analytics", { accountId });
        return NextResponse.json(JSON.parse(cached));
      }
    } catch (cacheError) {
      logger.warn("Cache error (continuing without cache)", cacheError);
    }

    // Decrypt access token
    const accessToken = decrypt(account.accessToken);

    // Fetch analytics - pass context object and limit
    logger.debug("Fetching fresh analytics", { accountId, tweetLimit });
    const analytics = await getTwitterAnalytics({ accessToken }, tweetLimit);

    // Cache the result for 5 minutes to avoid rate limits
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(analytics));
      logger.debug("Cached analytics", { accountId });
    } catch (cacheError) {
      logger.warn("Failed to cache analytics", cacheError);
    }

    return NextResponse.json(analytics);
  } catch (error) {
    logger.error("Error fetching Twitter analytics", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Handle rate limit errors specifically
    if (errorMessage.includes("429") || errorMessage.includes("Rate limit")) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again in 15 minutes.",
          retryAfter: 900, // 15 minutes in seconds
        },
        {
          status: 429,
          headers: {
            "Retry-After": "900",
          },
        }
      );
    }

    // Handle auth errors
    if (
      errorMessage.includes("401") ||
      errorMessage.includes("403") ||
      errorMessage.includes("Authentication failed")
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication failed. Please reconnect your Twitter account.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
