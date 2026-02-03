import { NextResponse } from "next/server";

/**
 * Health check for the Next.js app.
 * Use this endpoint for uptime monitoring (e.g. UptimeRobot, Better Stack, PagerDuty).
 * Returns 200 when the app is running. For deeper checks (DB/Redis), extend as needed.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "shitposter-web",
    },
    { status: 200 }
  );
}
