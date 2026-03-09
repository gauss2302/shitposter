import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Reset module state by re-importing would require vitest isolate, so we just test behavior
    // with unique identifiers per test
  });

  it("allows requests under the limit", () => {
    const id = "allow-" + Math.random();
    const r1 = checkRateLimit(id, 2, 60_000);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(1);

    const r2 = checkRateLimit(id, 2, 60_000);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(0);
  });

  it("returns ok: false when limit exceeded", () => {
    const id = "exceed-" + Math.random();
    checkRateLimit(id, 2, 60_000);
    checkRateLimit(id, 2, 60_000);
    const r3 = checkRateLimit(id, 2, 60_000);
    expect(r3.ok).toBe(false);
    expect(r3.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("getClientIp", () => {
  it("returns x-forwarded-for first IP", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": " 1.2.3.4 , 5.6.7.8 " },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns x-real-ip when no x-forwarded-for", () => {
    const req = new Request("http://x", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("returns unknown when no IP headers", () => {
    const req = new Request("http://x");
    expect(getClientIp(req)).toBe("unknown");
  });
});
