import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import * as Sentry from "@sentry/node";
import { logger } from "@/lib/logger";
import { createPostWorker } from "./index";
import { startHealthServer } from "./health";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}

logger.info("Worker starting", {
  queue: "post-publishing",
  redis: process.env.REDIS_URL ? "configured" : "missing",
  database: process.env.DATABASE_URL ? "configured" : "missing",
  encryption: process.env.TOKEN_ENCRYPTION_KEY ? "yes" : "no",
  concurrency: process.env.WORKER_CONCURRENCY || 3,
  rateLimit: process.env.WORKER_RATE_LIMIT || 10,
});

// Verify required environment variables
const requiredEnvVars = ["REDIS_URL", "DATABASE_URL", "TOKEN_ENCRYPTION_KEY"];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  logger.error("Missing environment variables:", missingVars.join(", "));
  Sentry.captureMessage(`Worker missing env: ${missingVars.join(", ")}`, "error");
  process.exit(1);
}

let worker: Awaited<ReturnType<typeof createPostWorker>> | null = null;
let healthServer: Awaited<ReturnType<typeof startHealthServer>> | null = null;
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("Graceful shutdown started", { signal });

  const shutdownTimeout = setTimeout(() => {
    logger.error("Shutdown timeout - forcing exit");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Stop accepting new jobs
    if (worker) {
      logger.info("Closing worker...");
      await worker.close();
      logger.info("Worker closed");
    }

    // Close health server
    if (healthServer) {
      logger.info("Closing health server...");
      healthServer.close();
      logger.info("Health server closed");
    }

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error("Shutdown error", error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

async function main() {
  try {
    // Start health server first
    healthServer = await startHealthServer();

    // Create and start worker
    worker = createPostWorker();

    logger.info("Worker started successfully, watching for jobs");

    // Graceful shutdown handlers
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception", error);
      shutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Rejection", reason);
      shutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    logger.error("Failed to start worker", error);
    Sentry.captureException(error);
    process.exit(1);
  }
}

main();
