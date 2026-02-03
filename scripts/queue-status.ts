// scripts/queue-status.ts
import { Queue } from "bullmq";
import { logger } from "../lib/logger";
import { createRedisConnection } from "../lib/queue/connection";

async function checkQueueStatus() {
  const postQueue = new Queue("post-publishing", {
    connection: createRedisConnection(),
  });

  logger.info("Queue Status: post-publishing");

  try {
    // Get job counts
    const counts = await postQueue.getJobCounts(
      "wait",
      "active",
      "completed",
      "failed",
      "delayed",
      "paused"
    );

    logger.info("Job counts", counts);

    // Show failed jobs
    if (counts.failed > 0) {
      const failedJobs = await postQueue.getFailed(0, 10); // Get first 10
      for (const job of failedJobs) {
        logger.info("Failed job", {
          jobId: job.id,
          postId: job.data.postId,
          targetId: job.data.targetId,
          account: job.data.socialAccountId,
          attempts: `${job.attemptsMade}/${job.opts.attempts}`,
          error: job.failedReason,
        });
      }
      if (counts.failed > 10) {
        logger.info("More failed jobs", { remaining: counts.failed - 10 });
      }
    }

    // Show waiting jobs
    if (counts.wait > 0) {
      const waitingJobs = await postQueue.getWaiting(0, 5); // Get first 5
      for (const job of waitingJobs) {
        logger.info("Waiting job", {
          jobId: job.id,
          postId: job.data.postId,
          targetId: job.data.targetId,
        });
      }
      if (counts.wait > 5) {
        logger.info("More waiting jobs", { remaining: counts.wait - 5 });
      }
    }

    // Show active jobs
    if (counts.active > 0) {
      const activeJobs = await postQueue.getActive(0, 5);
      for (const job of activeJobs) {
        logger.info("Active job", {
          jobId: job.id,
          postId: job.data.postId,
          targetId: job.data.targetId,
        });
      }
    }
  } catch (error) {
    logger.error("Error checking queue status", error);
  } finally {
    await postQueue.close();
    process.exit(0);
  }
}

checkQueueStatus();
