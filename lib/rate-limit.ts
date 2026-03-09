/**
 * In-memory rate limiter for API routes. Use in route handlers when you need
 * to limit by something other than IP (e.g. session id), or when not using middleware.
 * For VPS single-instance, in-memory is sufficient; for multi-instance use Redis or proxy rate limit.
 */

const store = new Map<
  string,
  { count: number; resetAt: number }
>();

const WINDOW_MS = 60 * 1000; // 1 minute

function getKey(identifier: string, prefix: string): string {
  return `${prefix}:${identifier}`;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSec: number;
}

/**
 * Check rate limit. Returns result; if !result.ok, return 429 with Retry-After.
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = WINDOW_MS,
  prefix: string = "api"
): RateLimitResult {
  const now = Date.now();
  const key = getKey(identifier, prefix);
  const entry = store.get(key);

  if (!entry) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      ok: true,
      remaining: limit - 1,
      resetAt: new Date(now + windowMs),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  if (now >= entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    store.set(key, entry);
    return {
      ok: true,
      remaining: limit - 1,
      resetAt: new Date(entry.resetAt),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  entry.count += 1;
  const over = entry.count > limit;
  return {
    ok: !over,
    remaining: Math.max(0, limit - entry.count),
    resetAt: new Date(entry.resetAt),
    retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/** Get client IP from NextRequest (works in route handlers). */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
