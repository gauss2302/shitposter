/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from "dotenv";
import { Worker, Job } from "bullmq";
import * as crypto from "crypto";
import { createRedisConnection } from "@/lib/queue/connection";
import {
  publishToTwitter,
  publishToInstagram,
  publishToTikTok,
  publishToLinkedIn,
} from "@/lib/queue/publishers";
import { PublishPostJobData } from "@/lib/queue/queues";
import { db, post, postTarget, socialAccount } from "@/lib/db";
import { eq } from "drizzle-orm";
import { uploadMultipleMedia } from "@/lib/social/twitter-media";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is not set");
  }
  return crypto.createHash("sha256").update(key).digest();
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();

  // Extract iv, authTag, and encrypted data
  const iv = Buffer.from(encryptedText.slice(0, IV_LENGTH * 2), "hex");
  const authTag = Buffer.from(
    encryptedText.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2),
    "hex"
  );
  const encrypted = encryptedText.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function createPostWorker() {
  const worker = new Worker<PublishPostJobData>(
    "post-publishing",
    async (job: Job<PublishPostJobData>) => {
      const { postId, targetId, socialAccountId, content, mediaData } =
        job.data;

      console.log(
        `📤 Processing job ${
          job.id
        }: Post ${postId} to account ${socialAccountId}${
          mediaData?.length ? ` with ${mediaData.length} media files` : ""
        }`
      );

      try {
        // Verify target exists
        const target = await db.query.postTarget.findFirst({
          where: eq(postTarget.id, targetId),
        });

        if (!target) {
          throw new Error(
            `Post target ${targetId} not found in database. This may indicate a race condition.`
          );
        }

        console.log(`✅ Found target ${targetId} for post ${postId}`);

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

        // Handle media upload for Twitter
        let mediaIds: string[] = [];

        if (
          mediaData &&
          mediaData.length > 0 &&
          account.platform === "twitter"
        ) {
          console.log(
            `📸 Uploading ${mediaData.length} media files to Twitter...`
          );

          try {
            // Convert base64 back to buffers and upload
            const files = mediaData.map((media) => ({
              buffer: Buffer.from(media.data, "base64"),
              mimeType: media.mimeType,
            }));

            mediaIds = await uploadMultipleMedia({ accessToken }, files);
            console.log(
              `✅ Uploaded ${mediaIds.length} media files, IDs: ${mediaIds.join(
                ", "
              )}`
            );
          } catch (uploadError) {
            console.error(`❌ Media upload failed:`, uploadError);
            throw new Error(
              `Failed to upload media: ${
                uploadError instanceof Error
                  ? uploadError.message
                  : "Unknown error"
              }`
            );
          }
        }

        // Publish based on platform
        let platformPostId: string;

        console.log(`🚀 Publishing to ${account.platform}...`);

        switch (account.platform) {
          case "twitter":
            platformPostId = await publishToTwitter({
              accessToken,
              content,
              mediaIds, // Pass media IDs
            });
            break;
          case "instagram":
            // For Instagram, you'd need to convert mediaData to URLs first
            platformPostId = await publishToInstagram({
              accessToken,
              content,
              mediaUrls: [], // Instagram requires URLs, not IDs
            });
            break;
          case "tiktok":
            platformPostId = await publishToTikTok({
              accessToken,
              content,
              mediaUrls: [], // TikTok requires URLs
            });
            break;
          case "linkedin":
            platformPostId = await publishToLinkedIn({
              accessToken,
              accountId: account.platformUserId,
              content,
              mediaUrls: [],
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

        // Update post status
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
      concurrency: 3,
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
