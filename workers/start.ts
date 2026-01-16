import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { createPostWorker } from "./index";
import { startHealthServer } from "./health";

console.log("═══════════════════════════════════════════════════════════");
console.log("🚀 shitpost.art Worker - Starting...");
console.log("═══════════════════════════════════════════════════════════");
console.log(`📋 Queue: post-publishing`);
console.log(`🔗 Redis: ${process.env.REDIS_URL?.replace(/:[^:@]+@/, ":***@")}`);
console.log(
  `🗄️  Database: ${process.env.DATABASE_URL?.split("@")[1] || "configured"}`
);
console.log(`🔐 Encryption: ${process.env.TOKEN_ENCRYPTION_KEY ? "✅" : "❌"}`);
console.log(`⚡ Concurrency: ${process.env.WORKER_CONCURRENCY || 3}`);
console.log(`🚦 Rate Limit: ${process.env.WORKER_RATE_LIMIT || 10}/sec`);
console.log("═══════════════════════════════════════════════════════════");

// Verify required environment variables
const requiredEnvVars = ["REDIS_URL", "DATABASE_URL", "TOKEN_ENCRYPTION_KEY"];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

if (missingVars.length > 0) {
  console.error("❌ Missing environment variables:", missingVars.join(", "));
  process.exit(1);
}

let worker: Awaited<ReturnType<typeof createPostWorker>> | null = null;
let healthServer: Awaited<ReturnType<typeof startHealthServer>> | null = null;
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⏹️  ${signal} received - Graceful shutdown started...`);

  const shutdownTimeout = setTimeout(() => {
    console.error("❌ Shutdown timeout - forcing exit");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Stop accepting new jobs
    if (worker) {
      console.log("   Closing worker...");
      await worker.close();
      console.log("   ✅ Worker closed");
    }

    // Close health server
    if (healthServer) {
      console.log("   Closing health server...");
      healthServer.close();
      console.log("   ✅ Health server closed");
    }

    clearTimeout(shutdownTimeout);
    console.log("✅ Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Shutdown error:", error);
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

    console.log("═══════════════════════════════════════════════════════════");
    console.log("✅ Worker started successfully!");
    console.log("👀 Watching for jobs...");
    console.log("═══════════════════════════════════════════════════════════");

    // Graceful shutdown handlers
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      shutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", (reason) => {
      console.error("❌ Unhandled Rejection:", reason);
      shutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  }
}

main();
