import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getRedis } from "@/lib/queue/connection";

/**
 * Health check for the Next.js app.
 * GET /api/health — lightweight 200 when the app is running (for load balancers).
 * GET /api/health?deep=1 — checks DB and Redis; returns 503 if either is down (for alerting).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";

  const base = {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
    service: "shitposter-web",
  };

  if (!deep) {
    return NextResponse.json(base, { status: 200 });
  }

  let dbOk = false;
  let redisOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB unreachable
  }
  try {
    const redis = getRedis();
    await redis.ping();
    redisOk = true;
  } catch {
    // Redis unreachable
  }

  const healthy = dbOk && redisOk;
  const body = {
    ...base,
    deep: true,
    database: dbOk ? "connected" : "disconnected",
    redis: redisOk ? "connected" : "disconnected",
  };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
