import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db, post, postTarget, socialAccount } from "@/lib/db";
import { schedulePost, publishPostNow } from "@/lib/queue/queues";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse form data (for file uploads)
    const formData = await request.formData();

    const content = formData.get("content") as string;
    const socialAccountIdsJson = formData.get("socialAccountIds") as string;
    const scheduledForStr = formData.get("scheduledFor") as string | null;

    // Get media files
    const mediaFiles = formData.getAll("media") as File[];

    // 🔍 DEBUG: Log what we received
    console.log("═══════════════════════════════════════");
    console.log("📥 POST /api/posts - Request received");
    console.log("═══════════════════════════════════════");
    console.log("👤 User ID:", session.user.id);
    console.log("📝 Content length:", content?.length || 0);
    console.log("📸 Media files count:", mediaFiles.length);

    if (mediaFiles.length > 0) {
      console.log("📸 Media files details:");
      mediaFiles.forEach((file, i) => {
        console.log(`  ${i + 1}. ${file.name}`);
        console.log(`     Type: ${file.type}`);
        console.log(`     Size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      });
    } else {
      console.log("📸 No media files attached");
    }

    // Validate content
    if (!content?.trim() && mediaFiles.length === 0) {
      console.log("❌ Validation failed: No content or media");
      return NextResponse.json(
        { error: "Content or media is required" },
        { status: 400 }
      );
    }

    // Parse social account IDs
    const socialAccountIds = JSON.parse(socialAccountIdsJson);
    console.log("🎯 Target accounts:", socialAccountIds.length);

    if (!Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
      console.log("❌ Validation failed: No accounts selected");
      return NextResponse.json(
        { error: "At least one account is required" },
        { status: 400 }
      );
    }

    // Verify all social accounts belong to the user
    const accounts = await db.query.socialAccount.findMany({
      where: (sa, { and, eq: eqOp, inArray: inArrayOp }) =>
        and(
          eqOp(sa.userId, session.user.id),
          inArrayOp(sa.id, socialAccountIds)
        ),
    });

    if (accounts.length !== socialAccountIds.length) {
      console.log("❌ Validation failed: Account ownership mismatch");
      return NextResponse.json(
        { error: "One or more accounts not found or not owned by you" },
        { status: 400 }
      );
    }

    console.log("✅ Account verification passed");
    accounts.forEach((acc) => {
      console.log(`  - @${acc.platformUsername} (${acc.platform})`);
    });

    // Check for inactive accounts
    const inactiveAccounts = accounts.filter((a) => !a.isActive);
    if (inactiveAccounts.length > 0) {
      console.log("❌ Validation failed: Inactive accounts found");
      return NextResponse.json(
        {
          error: `Some accounts are disconnected: ${inactiveAccounts
            .map((a) => a.platformUsername)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Process media files and convert to base64
    console.log("🔄 Processing media files...");
    const mediaData: Array<{ data: string; mimeType: string }> = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      console.log(
        `  Processing file ${i + 1}/${mediaFiles.length}: ${file.name}`
      );

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");

      mediaData.push({
        data: base64,
        mimeType: file.type,
      });

      console.log(
        `  ✅ Converted to base64: ${base64.length.toLocaleString()} characters`
      );
    }

    console.log(`✅ Total media data items: ${mediaData.length}`);

    // Create the post
    const postId = nanoid();
    console.log("📝 Creating post with ID:", postId);

    // Parse and validate scheduled time
    let scheduledFor: Date | null = null;
    if (scheduledForStr) {
      scheduledFor = new Date(scheduledForStr);

      if (isNaN(scheduledFor.getTime())) {
        console.log("❌ Invalid scheduled date format");
        return NextResponse.json(
          { error: "Invalid scheduled date format" },
          { status: 400 }
        );
      }

      const oneMinuteAgo = Date.now() - 60000;
      if (scheduledFor.getTime() < oneMinuteAgo) {
        console.warn(
          `⚠️ Scheduled time ${scheduledFor.toISOString()} is in the past, posting immediately`
        );
        scheduledFor = null;
      }

      const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000;
      if (scheduledFor && scheduledFor.getTime() > oneYearFromNow) {
        console.log("❌ Scheduled date too far in future");
        return NextResponse.json(
          { error: "Scheduled date cannot be more than 1 year in the future" },
          { status: 400 }
        );
      }

      if (scheduledFor) {
        console.log(`📅 Scheduled for: ${scheduledFor.toISOString()}`);
      }
    } else {
      console.log("🚀 Publishing immediately");
    }

    // Insert post (don't store media in DB, send in job data)
    await db.insert(post).values({
      id: postId,
      userId: session.user.id,
      content: content || "",
      mediaUrls: [], // We'll generate URLs after upload
      scheduledFor,
      status: scheduledFor ? "scheduled" : "publishing",
    });

    console.log(
      `✅ Created post: ${postId}${
        mediaData.length > 0 ? ` with ${mediaData.length} media files` : ""
      }`
    );

    // Create post targets
    console.log("🎯 Creating post targets...");
    const targets = [];
    for (const account of accounts) {
      const targetId = nanoid();

      targets.push({
        id: targetId,
        postId,
        socialAccountId: account.id,
        status: "pending" as const,
      });

      console.log(
        `  Created target: ${targetId} for @${account.platformUsername}`
      );
    }

    // Insert all targets at once
    await db.insert(postTarget).values(targets);
    console.log(`✅ Created ${targets.length} post targets`);

    // Queue the jobs with media data
    console.log("📋 Queueing jobs...");
    const jobPromises = [];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const account = accounts[i];

      const jobData = {
        postId,
        userId: session.user.id,
        targetId: target.id,
        socialAccountId: account.id,
        content: content || "",
        mediaData, // Include media data in job
      };

      console.log(
        `📋 Queuing job ${i + 1}/${targets.length}: target ${target.id} → @${
          account.platformUsername
        } (${account.platform})${
          mediaData.length > 0 ? ` with ${mediaData.length} media` : ""
        }`
      );

      // Schedule or publish immediately
      if (scheduledFor && scheduledFor > new Date()) {
        jobPromises.push(schedulePost(jobData, scheduledFor));
      } else {
        jobPromises.push(publishPostNow(jobData));
      }
    }

    // Wait for all jobs to be queued
    await Promise.all(jobPromises);
    console.log(`✅ Queued ${jobPromises.length} jobs successfully`);
    console.log("═══════════════════════════════════════");

    return NextResponse.json({
      success: true,
      post: {
        id: postId,
        status: scheduledFor ? "scheduled" : "publishing",
        scheduledFor: scheduledFor?.toISOString(),
        targetCount: targets.length,
        mediaCount: mediaData.length,
      },
    });
  } catch (error) {
    console.error("═══════════════════════════════════════");
    console.error("❌ Error creating post:", error);
    console.error("═══════════════════════════════════════");
    return NextResponse.json(
      {
        error: "Failed to create post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET handler remains the same
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await db.query.post.findMany({
    where: eq(post.userId, session.user.id),
    orderBy: (p, { desc }) => desc(p.createdAt),
    limit: 50,
  });

  const postsWithTargets = await Promise.all(
    posts.map(async (p) => {
      const targets = await db.query.postTarget.findMany({
        where: eq(postTarget.postId, p.id),
      });

      const targetAccountIds = targets.map((t) => t.socialAccountId);
      const accounts =
        targetAccountIds.length > 0
          ? await db.query.socialAccount.findMany({
              where: inArray(socialAccount.id, targetAccountIds),
            })
          : [];

      return {
        ...p,
        targets: targets.map((t) => ({
          ...t,
          account: accounts.find((a) => a.id === t.socialAccountId),
        })),
      };
    })
  );

  return NextResponse.json({ posts: postsWithTargets });
}
