// scripts/clean-queue.ts
import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/queue/connection";

async function cleanQueue() {
  const postQueue = new Queue("post-publishing", {
    connection: createRedisConnection(),
  });

  console.log("🧹 Cleaning queue: post-publishing");

  try {
    // Get counts before cleaning
    const counts = await postQueue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused"
    );

    console.log("\n📊 Current queue status:");
    console.log(`  - Waiting: ${counts.wait}`);
    console.log(`  - Active: ${counts.active}`);
    console.log(`  - Completed: ${counts.completed}`);
    console.log(`  - Failed: ${counts.failed}`);
    console.log(`  - Delayed: ${counts.delayed}`);
    console.log(`  - Paused: ${counts.paused}`);

    // Clean completed jobs (older than 0 seconds = all)
    console.log("\n🗑️  Removing completed jobs...");
    const completedRemoved = await postQueue.clean(0, 0, "completed");
    console.log(`✅ Removed ${completedRemoved.length} completed jobs`);

    // Clean failed jobs
    console.log("\n🗑️  Removing failed jobs...");
    const failedRemoved = await postQueue.clean(0, 0, "failed");
    console.log(`✅ Removed ${failedRemoved.length} failed jobs`);

    // Remove all waiting jobs
    console.log("\n🗑️  Removing waiting jobs...");
    const waitingJobs = await postQueue.getWaiting();
    for (const job of waitingJobs) {
      await job.remove();
    }
    console.log(`✅ Removed ${waitingJobs.length} waiting jobs`);

    // Remove all delayed jobs
    console.log("\n🗑️  Removing delayed jobs...");
    const delayedJobs = await postQueue.getDelayed();
    for (const job of delayedJobs) {
      await job.remove();
    }
    console.log(`✅ Removed ${delayedJobs.length} delayed jobs`);

    // Get final counts
    const finalCounts = await postQueue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
      "delayed"
    );

    console.log("\n📊 Final queue status:");
    console.log(`  - Waiting: ${finalCounts.wait}`);
    console.log(`  - Active: ${finalCounts.active}`);
    console.log(`  - Completed: ${finalCounts.completed}`);
    console.log(`  - Failed: ${finalCounts.failed}`);
    console.log(`  - Delayed: ${finalCounts.delayed}`);

    console.log("\n✨ Queue cleaned successfully!");
  } catch (error) {
    console.error("❌ Error cleaning queue:", error);
  } finally {
    await postQueue.close();
    process.exit(0);
  }
}

cleanQueue();
