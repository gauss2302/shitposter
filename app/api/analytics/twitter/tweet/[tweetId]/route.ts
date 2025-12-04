import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/utils";
import { getTwitterAnalytics } from "@/lib/social/twitter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: accountId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    // Get the connected Twitter account
    const account = await db.query.socialAccount.findFirst({
      where: (sa, { and: andOp, eq: eqOp }) =>
        andOp(
          eqOp(sa.id, accountId),
          eqOp(sa.userId, session.user.id),
          eqOp(sa.platform, "twitter")
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
        { error: "Twitter account is disconnected. Please reconnect." },
        { status: 403 }
      );
    }

    // Decrypt the user's access token
    const accessToken = decrypt(account.accessToken);

    // Fetch analytics using the user's token
    // This counts against THEIR quota (1,667/month), not your app's quota (100/month)!
    const analytics = await getTwitterAnalytics(
      { accessToken },
      Math.min(limit, 100) // Cap at 100
    );

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Error fetching Twitter analytics:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch analytics";

    // Check for rate limit errors
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please try again later or reduce the number of tweets.",
        },
        { status: 429 }
      );
    }

    // Check for auth errors
    if (errorMessage.includes("401") || errorMessage.includes("403")) {
      return NextResponse.json(
        {
          error:
            "Authentication failed. Please reconnect your Twitter account.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
