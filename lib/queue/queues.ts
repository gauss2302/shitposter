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
  mediaUrls?: string[];
}

// Helper to schedule a post
export async function schedulePost(
  data: PublishPostJobData,
  scheduledFor: Date
) {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());

  return postQueue.add("publish", data, {
    delay,
    jobId: `post-${data.postId}-${data.targetId}`, // Prevent duplicates
  });
}

// Helper to publish immediately
export async function publishPostNow(data: PublishPostJobData) {
  return postQueue.add("publish", data, {
    jobId: `post-${data.postId}-${data.targetId}`,
  });
}
