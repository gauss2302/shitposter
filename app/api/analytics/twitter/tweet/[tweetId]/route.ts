import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, socialAccount, postTarget } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { decrypt } from "@/lib/utils";
import { getTwitterTweetMetrics } from "@/lib/analytics/twitter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tweetId: string }> }
) {
  const { tweetId } = await params;

  // Verify user is authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get account ID from query params
    const accountId = request.nextUrl.searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId query parameter required" },
        { status: 400 }
      );
    }

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

    // Decrypt access token
    const accessToken = decrypt(account.accessToken);

    // Fetch tweet metrics
    const metrics = await getTwitterTweetMetrics(accessToken, tweetId);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error fetching tweet metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tweet metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Batch endpoint to fetch metrics for multiple tweets
export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountId, tweetIds } = body;

    if (!accountId || !tweetIds || !Array.isArray(tweetIds)) {
      return NextResponse.json(
        { error: "accountId and tweetIds array required" },
        { status: 400 }
      );
    }

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

    // Decrypt access token
    const accessToken = decrypt(account.accessToken);

    // Fetch metrics for all tweets
    const metricsPromises = tweetIds.map((tweetId: string) =>
      getTwitterTweetMetrics(accessToken, tweetId).catch((err) => ({
        id: tweetId,
        error: err.message,
      }))
    );

    const metrics = await Promise.all(metricsPromises);

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Error fetching batch tweet metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch batch tweet metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
