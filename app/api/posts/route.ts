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

    // Validate content
    if (!content?.trim() && mediaFiles.length === 0) {
      return NextResponse.json(
        { error: "Content or media is required" },
        { status: 400 }
      );
    }

    // Parse social account IDs
    const socialAccountIds = JSON.parse(socialAccountIdsJson);

    if (!Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
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
      return NextResponse.json(
        { error: "One or more accounts not found or not owned by you" },
        { status: 400 }
      );
    }

    // Check for inactive accounts
    const inactiveAccounts = accounts.filter((a) => !a.isActive);
    if (inactiveAccounts.length > 0) {
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
    const mediaData: Array<{ data: string; mimeType: string }> = [];

    for (const file of mediaFiles) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");

      mediaData.push({
        data: base64,
        mimeType: file.type,
      });
    }

    // Create the post
    const postId = nanoid();

    // Parse and validate scheduled time
    let scheduledFor: Date | null = null;
    if (scheduledForStr) {
      scheduledFor = new Date(scheduledForStr);

      if (isNaN(scheduledFor.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduled date format" },
          { status: 400 }
        );
      }

      const oneMinuteAgo = Date.now() - 60000;
      if (scheduledFor.getTime() < oneMinuteAgo) {
        console.warn(
          `⚠️ Scheduled time ${scheduledFor.toISOString()} is in the past`
        );
        scheduledFor = null;
      }

      const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000;
      if (scheduledFor!.getTime() > oneYearFromNow) {
        return NextResponse.json(
          { error: "Scheduled date cannot be more than 1 year in the future" },
          { status: 400 }
        );
      }
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
    const targets = [];
    for (const account of accounts) {
      const targetId = nanoid();

      targets.push({
        id: targetId,
        postId,
        socialAccountId: account.id,
        status: "pending",
      });
    }

    // Insert all targets at once
    await db.insert(postTarget).values(targets);
    console.log(`✅ Created ${targets.length} post targets`);

    // Queue the jobs with media data
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
        `📋 Queuing job for target: ${target.id} (account: @${account.platformUsername})`
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
    console.log(`✅ Queued ${jobPromises.length} jobs`);

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
    console.error("❌ Error creating post:", error);
    return NextResponse.json(
      {
        error: "Failed to create post",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Keep your existing GET handler...
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
