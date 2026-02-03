/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { Worker, Job } from "bullmq";
import * as crypto from "crypto";
import * as Sentry from "@sentry/node";
import { logger } from "@/lib/logger";
import { createRedisConnection } from "@/lib/queue/connection";
import {
  publishToTwitter,
  refreshTwitterToken,
  publishToInstagram,
  publishToTikTok,
  publishToLinkedIn,
} from "@/lib/queue/publishers";
import { PublishPostJobData } from "@/lib/queue/queues";
import {
  workerDb as db,
  post,
  postTarget,
  socialAccount,
} from "@/lib/db/worker-connection";
import { eq } from "drizzle-orm";
import { uploadMultipleMedia } from "@/lib/social/twitter-media";
import { workerMetrics } from "./health";

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

function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return iv.toString("hex") + authTag.toString("hex") + encrypted;
}

// Categorize errors for smart retry logic
function categorizeError(
  error: Error
): "auth" | "rate_limit" | "network" | "permanent" | "temporary" {
  const message = error.message.toLowerCase();

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("authentication")
  ) {
    return "auth";
  }
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("too many")
  ) {
    return "rate_limit";
  }
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return "network";
  }
  if (
    message.includes("invalid") ||
    message.includes("not found") ||
    message.includes("does not exist")
  ) {
    return "permanent";
  }
  return "temporary";
}

export function createPostWorker() {
  const worker = new Worker<PublishPostJobData>(
    "post-publishing",
    async (job: Job<PublishPostJobData>) => {
      const { postId, targetId, socialAccountId, content, mediaData } =
        job.data;

      // Update metrics
      workerMetrics.isProcessing = true;
      workerMetrics.lastJobAt = new Date();

      logger.info(`[Job ${job.id}] Processing`, {
        postId,
        socialAccountId,
        attempt: `${job.attemptsMade + 1}/${job.opts.attempts}`,
      });

      try {
        // Verify target exists
        const target = await db.query.postTarget.findFirst({
          where: eq(postTarget.id, targetId),
        });

        if (!target) {
          throw new Error(`Post target ${targetId} not found`);
        }

        // Update status to publishing
        await db
          .update(postTarget)
          .set({ status: "publishing" })
          .where(eq(postTarget.id, targetId));

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

        logger.debug("Target account", {
          username: account.platformUsername,
          platform: account.platform,
        });

        // Decrypt access token
        let accessToken = decrypt(account.accessToken);

        // Check if token needs refresh
        if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
          logger.info("Token expired, refreshing");

          if (!account.refreshToken) {
            await db
              .update(socialAccount)
              .set({ isActive: false })
              .where(eq(socialAccount.id, socialAccountId));
            throw new Error(`Token expired and no refresh token available`);
          }

          try {
            const refreshToken = decrypt(account.refreshToken);
            let newTokens: {
              accessToken: string;
              refreshToken: string;
              expiresIn: number;
            };

            switch (account.platform) {
              case "twitter":
                newTokens = await refreshTwitterToken(refreshToken);
                break;
              default:
                throw new Error(
                  `Token refresh not implemented for ${account.platform}`
                );
            }

            await db
              .update(socialAccount)
              .set({
                accessToken: encrypt(newTokens.accessToken),
                refreshToken: encrypt(newTokens.refreshToken),
                tokenExpiresAt: new Date(
                  Date.now() + newTokens.expiresIn * 1000
                ),
                updatedAt: new Date(),
              })
              .where(eq(socialAccount.id, socialAccountId));

            accessToken = newTokens.accessToken;
            logger.info("Token refreshed");
          } catch (refreshError) {
            await db
              .update(socialAccount)
              .set({ isActive: false })
              .where(eq(socialAccount.id, socialAccountId));
            throw new Error(
              `Failed to refresh token: ${
                refreshError instanceof Error ? refreshError.message : "Unknown"
              }`
            );
          }
        }

        // Handle media upload for Twitter
        let mediaIds: string[] = [];

        if (
          mediaData &&
          mediaData.length > 0 &&
          account.platform === "twitter"
        ) {
          logger.debug("Uploading media files", { count: mediaData.length });

          // Get OAuth 1.0a credentials for media upload
          // Use oauth1AccessToken if available, otherwise fall back to accessToken (might be OAuth 1.0a)
          const oauth1AccessToken = account.oauth1AccessToken
            ? decrypt(account.oauth1AccessToken)
            : accessToken; // Fallback to regular accessToken if oauth1AccessToken not set
          
          const accessTokenSecret = account.accessTokenSecret
            ? decrypt(account.accessTokenSecret)
            : null;

          if (!accessTokenSecret) {
            throw new Error(
              "OAuth 1.0a accessTokenSecret is required for Twitter media upload. Please connect your Twitter account via OAuth 1.0a at /api/social/connect/twitter-oauth1"
            );
          }

          const consumerKey = process.env.TWITTER_CLIENT_ID;
          const consumerSecret = process.env.TWITTER_CLIENT_SECRET;

          if (!consumerKey || !consumerSecret) {
            throw new Error(
              "TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET are required for media upload"
            );
          }

          const files = mediaData.map((media) => ({
            buffer: Buffer.from(media.data, "base64"),
            mimeType: media.mimeType,
          }));

          mediaIds = await uploadMultipleMedia(
            {
              accessToken: oauth1AccessToken, // Use OAuth 1.0a token for media upload
              accessTokenSecret,
              consumerKey,
              consumerSecret,
            },
            files
          );
          logger.debug("Media uploaded", { mediaIds });
        }

        // Publish based on platform
        let platformPostId: string;

        logger.debug("Publishing to platform", { platform: account.platform });

        switch (account.platform) {
          case "twitter":
            platformPostId = await publishToTwitter({
              accessToken,
              content: content || "",
              mediaIds,
            });
            break;
          case "instagram":
            platformPostId = await publishToInstagram({
              accessToken,
              content,
              mediaUrls: [],
            });
            break;
          case "tiktok":
            if (mediaData && mediaData.length > 0) {
              const videoData = mediaData[0];
              const videoBuffer = Buffer.from(videoData.data, "base64");
              platformPostId = await publishToTikTok({
                accessToken,
                content,
                videoBuffer,
                videoMimeType: videoData.mimeType,
              });
            } else {
              throw new Error("TikTok requires a video file");
            }
            break;
          case "linkedin":
            // Prepare media files for LinkedIn if available
            let linkedInMediaFiles: Array<{ buffer: Buffer; mimeType: string }> | undefined;
            if (mediaData && mediaData.length > 0) {
              linkedInMediaFiles = mediaData.map((media) => ({
                buffer: Buffer.from(media.data, "base64"),
                mimeType: media.mimeType,
              }));
              logger.debug("Uploading media to LinkedIn", { count: linkedInMediaFiles.length });
            }
            platformPostId = await publishToLinkedIn({
              accessToken,
              accountId: account.platformUserId,
              content,
              mediaFiles: linkedInMediaFiles,
            });
            break;
          default:
            throw new Error(`Unsupported platform: ${account.platform}`);
        }

        logger.info("Published", { platformPostId, platform: account.platform });

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

        // Update metrics
        workerMetrics.jobsProcessed++;
        workerMetrics.isProcessing = false;

        return { success: true, platformPostId };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const errorCategory = categorizeError(
          error instanceof Error ? error : new Error(errorMessage)
        );

        logger.error(`Job error (${errorCategory})`, { errorMessage, jobId: job.id });

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

        // Update metrics
        workerMetrics.jobsFailed++;
        workerMetrics.isProcessing = false;

        // Don't retry auth errors - they won't fix themselves
        if (errorCategory === "auth") {
          logger.warn("Auth error - not retrying", { jobId: job.id });
          throw new Error(`[NO_RETRY] ${errorMessage}`);
        }

        // Rate limit - use longer backoff
        if (errorCategory === "rate_limit") {
          logger.warn("Rate limited - will retry with backoff", { jobId: job.id });
        }

        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3"),
      limiter: {
        max: parseInt(process.env.WORKER_RATE_LIMIT || "10"),
        duration: 1000,
      },
    }
  );

  // Event handlers
  worker.on("completed", (job) => {
    logger.info("Job completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    const isNoRetry = err.message.startsWith("[NO_RETRY]");
    logger.error("Job failed", {
      jobId: job?.id,
      attempts: `${job?.attemptsMade}/${job?.opts.attempts}`,
      message: err.message,
    });
    Sentry.captureException(err, {
      tags: {
        jobId: job ? String(job.id) : "unknown",
        postId: job?.data?.postId,
        socialAccountId: job?.data?.socialAccountId,
      },
    });

    if (isNoRetry) {
      logger.warn("Job will not be retried", { jobId: job?.id });
    }
  });

  worker.on("error", (err) => {
    logger.error("Worker error", err);
    Sentry.captureException(err);
  });

  worker.on("stalled", (jobId) => {
    logger.warn("Job stalled", { jobId });
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
}
