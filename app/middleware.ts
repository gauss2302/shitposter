import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In-memory rate limit store (Edge-compatible). Per-instance; for multi-instance use Redis or proxy.
const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const API_LIMIT = 120; // requests per minute per IP for general /api
const AUTH_LIMIT = 30; // stricter for auth routes

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function rateLimit(ip: string, limit: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const key = ip;
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSec: Math.ceil(WINDOW_MS / 1000) };
  }

  if (now >= entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + WINDOW_MS;
    store.set(key, entry);
    return { ok: true, retryAfterSec: Math.ceil(WINDOW_MS / 1000) };
  }

  entry.count += 1;
  const over = entry.count > limit;
  return {
    ok: !over,
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Only rate-limit API routes (skip health for probes/monitors)
  if (!path.startsWith("/api") || path === "/api/health") {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const limit = path.startsWith("/api/auth") ? AUTH_LIMIT : API_LIMIT;
  const { ok, retryAfterSec } = rateLimit(ip, limit);

  if (!ok) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", retryAfter: retryAfterSec }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
