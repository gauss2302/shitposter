import "dotenv/config";
import { createPostWorker } from "../lib/queue/worker";

console.log("🚀 Starting Social Poster workers...");
console.log(`📅 ${new Date().toISOString()}`);
console.log("");

// Create and start the post publishing worker
const postWorker = createPostWorker();

console.log("✅ Post publishing worker started");
console.log("👀 Waiting for jobs...");
console.log("");

// Graceful shutdown
async function shutdown() {
  console.log("");
  console.log("🛑 Shutting down workers...");

  await postWorker.close();

  console.log("✅ Workers shut down successfully");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Keep the process running
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
});
