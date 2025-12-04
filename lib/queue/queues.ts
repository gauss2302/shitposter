import { Queue } from "bullmq";
import { createRedisConnection } from "./connection";

// Post publishing queue
export const postQueue = new Queue("post-publishing", {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30000, // Start with 30s, then 60s, then 120s
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
    },
  },
});

// Types for job data
export interface PublishPostJobData {
  postId: string;
  userId: string;
  targetId: string; // postTarget.id
  socialAccountId: string;
  content: string;
  mediaData?: Array<{ data: string; mimeType: string }>; // Base64 media
}

// Helper to schedule a post
export async function schedulePost(
  data: PublishPostJobData,
  scheduledFor: Date
) {
  const now = Date.now();
  const scheduledTime = scheduledFor.getTime();

  // Calculate delay, ensuring it's positive
  let delay = scheduledTime - now;

  // If scheduled time is in the past, publish immediately
  if (delay < 0) {
    console.warn(
      `⚠️ Scheduled time is in the past (${scheduledFor.toISOString()}), publishing immediately`
    );
    delay = 1000; // 1 second delay
  }

  console.log(
    `📅 Scheduling post for ${scheduledFor.toISOString()} (in ${Math.round(
      delay / 1000
    )}s)`
  );

  return postQueue.add("publish", data, {
    delay,
    jobId: `post-${data.postId}-${data.targetId}`, // Prevent duplicates
  });
}

// Helper to publish immediately (with small safety delay)
export async function publishPostNow(data: PublishPostJobData) {
  console.log(`🚀 Publishing post immediately (with 1s delay)`);

  return postQueue.add("publish", data, {
    delay: 1000, // 1 second delay to ensure DB commit completes
    jobId: `post-${data.postId}-${data.targetId}`,
  });
}
