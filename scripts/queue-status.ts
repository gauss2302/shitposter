// scripts/queue-status.ts
import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/queue/connection";

async function checkQueueStatus() {
  const postQueue = new Queue("post-publishing", {
    connection: createRedisConnection(),
  });

  console.log("📊 Queue Status: post-publishing\n");

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

    console.log("Job Counts:");
    console.log(`  ⏳ Waiting:   ${counts.wait}`);
    console.log(`  🔄 Active:    ${counts.active}`);
    console.log(`  ✅ Completed: ${counts.completed}`);
    console.log(`  ❌ Failed:    ${counts.failed}`);
    console.log(`  ⏰ Delayed:   ${counts.delayed}`);
    console.log(`  ⏸️  Paused:    ${counts.paused}`);

    // Show failed jobs
    if (counts.failed > 0) {
      console.log("\n❌ Failed Jobs:");
      const failedJobs = await postQueue.getFailed(0, 10); // Get first 10
      for (const job of failedJobs) {
        console.log(`\n  Job ID: ${job.id}`);
        console.log(`  Post ID: ${job.data.postId}`);
        console.log(`  Target ID: ${job.data.targetId}`);
        console.log(`  Account: ${job.data.socialAccountId}`);
        console.log(`  Attempts: ${job.attemptsMade}/${job.opts.attempts}`);
        console.log(`  Error: ${job.failedReason}`);
      }

      if (counts.failed > 10) {
        console.log(`\n  ... and ${counts.failed - 10} more failed jobs`);
      }
    }

    // Show waiting jobs
    if (counts.wait > 0) {
      console.log("\n⏳ Waiting Jobs:");
      const waitingJobs = await postQueue.getWaiting(0, 5); // Get first 5
      for (const job of waitingJobs) {
        console.log(`\n  Job ID: ${job.id}`);
        console.log(`  Post ID: ${job.data.postId}`);
        console.log(`  Target ID: ${job.data.targetId}`);
      }

      if (counts.wait > 5) {
        console.log(`\n  ... and ${counts.wait - 5} more waiting jobs`);
      }
    }

    // Show active jobs
    if (counts.active > 0) {
      console.log("\n🔄 Active Jobs:");
      const activeJobs = await postQueue.getActive(0, 5);
      for (const job of activeJobs) {
        console.log(`\n  Job ID: ${job.id}`);
        console.log(`  Post ID: ${job.data.postId}`);
        console.log(`  Target ID: ${job.data.targetId}`);
      }
    }

    console.log("\n");
  } catch (error) {
    console.error("❌ Error checking queue status:", error);
  } finally {
    await postQueue.close();
    process.exit(0);
  }
}

checkQueueStatus();
