import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("logger", () => {
  const origEnv = process.env.NODE_ENV;
  const origFormat = process.env.LOG_FORMAT;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.LOG_FORMAT;
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    if (origFormat !== undefined) process.env.LOG_FORMAT = origFormat;
    else delete process.env.LOG_FORMAT;
  });

  it("exports debug, info, warn, error", async () => {
    const { logger } = await import("@/lib/logger");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("calls without throwing", async () => {
    const { logger } = await import("@/lib/logger");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("test message");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
