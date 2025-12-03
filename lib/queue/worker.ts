import { Worker, Job } from "bullmq";

import {
  workerDb,
  socialAccount,
  postTarget,
  post,
} from "../db/worker-connection";
import { eq } from "drizzle-orm";

import { decrypt } from "../utils";
import { createRedisConnection } from "./connection";
// Platform publishers
import { publishToTwitter } from "./publishers/twitter";
import { publishToInstagram } from "./publishers/instagram";
import { publishToLinkedIn } from "./publishers/linkedin";
import { publishToTikTok } from "./publishers/tiktok";
import { PublishPostJobData } from "./queues";

const db = workerDb;

export function createPostWorker() {
  const db = workerDb;
  const worker = new Worker<PublishPostJobData>(
    "post-publishing",
    async (job: Job<PublishPostJobData>) => {
      const { postId, targetId, socialAccountId, content, mediaUrls } =
        job.data;

      console.log(
        `📤 Processing job ${job.id}: Post ${postId} to account ${socialAccountId}`
      );

      try {
        // Update status to publishing
        await db
          .update(postTarget)
          .set({ status: "publishing" })
          .where(eq(postTarget.id, targetId));

        console.log(`✅ Updated target ${targetId} to publishing`);

        // Get social account details
        const account = await db.query.socialAccount.findFirst({
          where: eq(socialAccount.id, socialAccountId),
        });

        if (!account) {
          throw new Error(`Social account ${socialAccountId} not found`);
        }

        if (!account.isActive) {
          throw new Error(`Social account ${socialAccountId} is not active`);
        }

        console.log(`✅ Found account: @${account.platformUsername}`);

        // Decrypt access token
        const accessToken = decrypt(account.accessToken);
        const refreshToken = account.refreshToken
          ? decrypt(account.refreshToken)
          : undefined;

        // Check if token needs refresh
        if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
          if (!refreshToken) {
            // Mark account as inactive
            await db
              .update(socialAccount)
              .set({ isActive: false })
              .where(eq(socialAccount.id, socialAccountId));
            throw new Error(
              `Token expired and no refresh token available. User must reconnect.`
            );
          }
          // TODO: Implement token refresh logic per platform
        }

        // Publish based on platform
        let platformPostId: string;

        console.log(`🚀 Publishing to ${account.platform}...`);

        switch (account.platform) {
          case "twitter":
            platformPostId = await publishToTwitter({
              accessToken,
              content,
              mediaUrls,
            });
            break;
          case "instagram":
            platformPostId = await publishToInstagram({
              accessToken,
              content,
              mediaUrls,
            });
            break;
          case "tiktok":
            platformPostId = await publishToTikTok({
              accessToken,
              content,
              mediaUrls,
            });
            break;
          case "linkedin":
            platformPostId = await publishToLinkedIn({
              accessToken,
              accountId: account.platformUserId,
              content,
              mediaUrls,
            });
            break;
          default:
            throw new Error(`Unsupported platform: ${account.platform}`);
        }

        console.log(`✅ Published! Platform post ID: ${platformPostId}`);

        // Update target status to published
        await db
          .update(postTarget)
          .set({
            status: "published",
            platformPostId,
            publishedAt: new Date(),
          })
          .where(eq(postTarget.id, targetId));

        // Check if all targets are published, update post status
        await updatePostStatus(postId);

        console.log(
          `✅ Successfully published to ${account.platform}: ${platformPostId}`
        );

        return { success: true, platformPostId };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        console.error(`❌ Error publishing:`, errorMessage);

        // Update target status to failed
        await db
          .update(postTarget)
          .set({
            status: "failed",
            errorMessage,
          })
          .where(eq(postTarget.id, targetId));

        // Update post status
        await updatePostStatus(postId);

        console.error(
          `❌ Failed to publish to account ${socialAccountId}:`,
          errorMessage
        );

        throw error; // Re-throw to trigger retry
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 3, // Reduced from 5 to be safer
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `❌ Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
      err.message
    );
  });

  worker.on("error", (err) => {
    console.error("❌ Worker error:", err);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`⚠️  Job ${jobId} stalled`);
  });

  return worker;
}

// Helper to update post status based on all targets
async function updatePostStatus(postId: string) {
  const targets = await db.query.postTarget.findMany({
    where: eq(postTarget.postId, postId),
  });

  const statuses = targets.map((t) => t.status);

  let newStatus: string;

  if (statuses.every((s) => s === "published")) {
    newStatus = "published";
  } else if (statuses.some((s) => s === "failed")) {
    newStatus = statuses.some((s) => s === "published")
      ? "published"
      : "failed";
  } else if (statuses.some((s) => s === "publishing")) {
    newStatus = "publishing";
  } else {
    newStatus = "scheduled";
  }

  await db
    .update(post)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(post.id, postId));

  console.log(`✅ Updated post ${postId} status to: ${newStatus}`);
}
