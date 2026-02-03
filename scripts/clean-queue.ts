// scripts/clean-queue.ts
import { Queue } from "bullmq";
import { logger } from "../lib/logger";
import { createRedisConnection } from "../lib/queue/connection";

async function cleanQueue() {
  const postQueue = new Queue("post-publishing", {
    connection: createRedisConnection(),
  });

  logger.info("Cleaning queue: post-publishing");

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

    logger.info("Current queue status", counts);

    // Clean completed jobs (older than 0 seconds = all)
    logger.info("Removing completed jobs...");
    const completedRemoved = await postQueue.clean(0, 0, "completed");
    logger.info("Removed completed jobs", { count: completedRemoved.length });

    // Clean failed jobs
    logger.info("Removing failed jobs...");
    const failedRemoved = await postQueue.clean(0, 0, "failed");
    logger.info("Removed failed jobs", { count: failedRemoved.length });

    // Remove all waiting jobs
    logger.info("Removing waiting jobs...");
    const waitingJobs = await postQueue.getWaiting();
    for (const job of waitingJobs) {
      await job.remove();
    }
    logger.info("Removed waiting jobs", { count: waitingJobs.length });

    // Remove all delayed jobs
    logger.info("Removing delayed jobs...");
    const delayedJobs = await postQueue.getDelayed();
    for (const job of delayedJobs) {
      await job.remove();
    }
    logger.info("Removed delayed jobs", { count: delayedJobs.length });

    // Get final counts
    const finalCounts = await postQueue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
      "delayed"
    );

    logger.info("Final queue status", finalCounts);
    logger.info("Queue cleaned successfully");
  } catch (error) {
    logger.error("Error cleaning queue", error);
  } finally {
    await postQueue.close();
    process.exit(0);
  }
}

cleanQueue();
