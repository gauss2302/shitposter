/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/queue/worker.ts
import dotenv from "dotenv";
import { Worker, Job } from "bullmq";
import postgres from "postgres";
import * as crypto from "crypto";
import { createRedisConnection } from "@/lib/queue/connection";
import {
  publishToTwitter,
  publishToInstagram,
  publishToTikTok,
  publishToLinkedIn,
} from "@/lib/queue/publishers";
import { PublishPostJobData } from "@/lib/queue/queues";

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
      // Create a FRESH database connection for each job
      const connectionString = process.env.DATABASE_URL!;
      const sql = postgres(connectionString, {
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
        prepare: false, // IMPORTANT: Disable prepared statements to avoid parameter caching
      });

      const { postId, targetId, socialAccountId, content, mediaUrls } =
        job.data;

      console.log(
        `📤 Processing job ${job.id}: Post ${postId} to account ${socialAccountId}, target: ${targetId}`
      );

      try {
        // Update status to publishing - using raw SQL to avoid Drizzle parameter issues
        console.log(`✏️ Updating target ${targetId} to publishing...`);

        await sql`
          UPDATE post_target 
          SET status = 'publishing'
          WHERE id = ${targetId}
        `;

        console.log(`✅ Updated target ${targetId} to publishing`);

        // Get social account details - using raw SQL
        console.log(`🔍 Fetching account ${socialAccountId}...`);

        const accountRows = await sql`
          SELECT * FROM social_account 
          WHERE id = ${socialAccountId}
          LIMIT 1
        `;

        if (accountRows.length === 0) {
          throw new Error(`Social account ${socialAccountId} not found`);
        }

        const account = accountRows[0];

        if (!account.is_active) {
          throw new Error(`Social account ${socialAccountId} is not active`);
        }

        console.log(
          `✅ Found account: @${account.platform_username} (${account.platform})`
        );

        // Decrypt access token
        console.log(`🔓 Decrypting access token for ${account.platform}...`);
        const accessToken = decrypt(account.access_token);
        console.log(
          `✅ Access token decrypted (length: ${accessToken.length})`
        );

        const refreshToken = account.refresh_token
          ? decrypt(account.refresh_token)
          : undefined;

        // Check if token needs refresh
        if (
          account.token_expires_at &&
          new Date(account.token_expires_at) < new Date()
        ) {
          if (!refreshToken) {
            // Mark account as inactive
            await sql`
              UPDATE social_account 
              SET is_active = false 
              WHERE id = ${socialAccountId}
            `;

            throw new Error(
              `Token expired and no refresh token available. User must reconnect.`
            );
          }
          console.warn(
            `⚠️ Token expired for account ${socialAccountId}, needs refresh`
          );
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
              accountId: account.platform_user_id,
              content,
              mediaUrls,
            });
            break;
          default:
            throw new Error(`Unsupported platform: ${account.platform}`);
        }

        console.log(`✅ Published! Platform post ID: ${platformPostId}`);

        // Update target status to published - using raw SQL
        const now = new Date();
        await sql`
          UPDATE post_target 
          SET 
            status = 'published',
            platform_post_id = ${platformPostId},
            published_at = ${now.toISOString()}
          WHERE id = ${targetId}
        `;

        console.log(`✅ Updated target ${targetId} to published`);

        // Check if all targets are published, update post status
        await updatePostStatus(sql, postId);

        console.log(
          `✅ Successfully published to ${account.platform}: ${platformPostId}`
        );

        // Clean up connection
        await sql.end();

        return { success: true, platformPostId };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        console.error(`❌ Error publishing target ${targetId}:`, errorMessage);
        console.error(`❌ Stack trace:`, error);

        try {
          // Update target status to failed - using raw SQL
          await sql`
            UPDATE post_target 
            SET 
              status = 'failed',
              error_message = ${errorMessage}
            WHERE id = ${targetId}
          `;

          console.log(`✅ Updated target ${targetId} to failed`);

          // Update post status
          await updatePostStatus(sql, postId);
        } catch (updateError) {
          console.error(
            `❌ Failed to update target ${targetId} status to failed:`,
            updateError
          );
        }

        // Clean up connection even on error
        try {
          await sql.end();
        } catch (endError) {
          console.error(`❌ Failed to close database connection:`, endError);
        }

        // Re-throw to trigger retry
        throw error;
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
    console.error(`❌ Job data:`, job?.data);
  });

  worker.on("error", (err) => {
    console.error("❌ Worker error:", err);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`⚠️ Job ${jobId} stalled`);
  });

  return worker;
}

// Helper to update post status based on all targets
async function updatePostStatus(sql: any, postId: string) {
  console.log(`🔄 Updating post ${postId} status...`);

  // Get all targets for this post - using raw SQL
  const targets = await sql`
    SELECT * FROM post_target 
    WHERE post_id = ${postId}
  `;

  console.log(`📊 Found ${targets.length} targets for post ${postId}`);

  const statuses = targets.map((t: any) => t.status);

  let newStatus: string;

  if (statuses.every((s: string) => s === "published")) {
    newStatus = "published";
  } else if (statuses.some((s: string) => s === "failed")) {
    newStatus = statuses.some((s: string) => s === "published")
      ? "published"
      : "failed";
  } else if (statuses.some((s: string) => s === "publishing")) {
    newStatus = "publishing";
  } else {
    newStatus = "scheduled";
  }

  console.log(`✅ Setting post ${postId} status to: ${newStatus}`);

  // Update post status - using raw SQL
  const now = new Date();
  await sql`
    UPDATE post 
    SET 
      status = ${newStatus},
      updated_at = ${now.toISOString()}
    WHERE id = ${postId}
  `;

  console.log(`✅ Updated post ${postId} status to: ${newStatus}`);
}

console.log("🚀 Starting Social Poster worker...");
console.log(`📅 ${new Date().toISOString()}`);
const activeWorker = createPostWorker();
console.log("👀 Waiting for jobs...");

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals | "uncaughtException") {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`🛑 Received ${signal}, closing worker...`);
  try {
    await activeWorker.close();
    console.log("✅ Worker closed cleanly");
  } catch (error) {
    console.error("❌ Error while closing worker:", error);
  } finally {
    process.exit(signal === "uncaughtException" ? 1 : 0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled rejection at:", promise, "reason:", reason);
});
