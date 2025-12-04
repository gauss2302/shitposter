import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { decrypt } from "@/lib/utils";
import { getTwitterAnalytics } from "@/lib/analytics/twitter";

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

    // Decrypt access token
    const accessToken = decrypt(account.accessToken);

    // Get tweet limit from query params (default 50)
    const tweetLimit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "50"),
      100
    );

    // Fetch analytics
    const analytics = await getTwitterAnalytics(
      accessToken,
      account.platformUserId,
      tweetLimit
    );

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Error fetching Twitter analytics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
