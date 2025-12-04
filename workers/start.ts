import dotenv from "dotenv";
import { createPostWorker } from "./index";

// Load environment variables
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

console.log("═══════════════════════════════════════");
console.log("🚀 Starting BullMQ Worker for shitpost.art");
console.log("═══════════════════════════════════════");
console.log("📋 Queue: post-publishing");
console.log("🔗 Redis:", process.env.REDIS_URL?.slice(0, 30) + "...");
console.log("🗄️  Database:", process.env.DATABASE_URL?.slice(0, 30) + "...");
console.log(
  "🔐 Encryption Key:",
  process.env.TOKEN_ENCRYPTION_KEY ? "✅ Set" : "❌ Missing"
);
console.log("═══════════════════════════════════════");

// Verify required environment variables
const requiredEnvVars = ["REDIS_URL", "DATABASE_URL", "TOKEN_ENCRYPTION_KEY"];

const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error("\n💡 Tip: Check your .env and .env.local files");
  process.exit(1);
}

console.log("✅ All environment variables present");
console.log("🔧 Creating worker instance...");

// Create and start the worker
try {
  const worker = createPostWorker();

  console.log("✅ Worker created successfully");
  console.log("👀 Watching for jobs in queue: post-publishing");
  console.log("⚡ Ready to process posts!");
  console.log("═══════════════════════════════════════");
  console.log("");

  // Graceful shutdown handlers
  process.on("SIGTERM", async () => {
    console.log("\n⏹️  SIGTERM received, shutting down gracefully...");
    await worker.close();
    console.log("✅ Worker closed");
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n⏹️  SIGINT received (Ctrl+C), shutting down gracefully...");
    await worker.close();
    console.log("✅ Worker closed");
    process.exit(0);
  });

  // Keep the process alive
  process.stdin.resume();
} catch (error) {
  console.error("❌ Failed to create worker:", error);
  process.exit(1);
}
