import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, inArray } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db, post, postTarget, socialAccount } from "@/lib/db";
import { logger } from "@/lib/logger";
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

    logger.debug("POST /api/posts", {
      userId: session.user.id,
      contentLength: content?.length || 0,
      mediaCount: mediaFiles.length,
    });

    // Validate content
    if (!content?.trim() && mediaFiles.length === 0) {
      return NextResponse.json(
        { error: "Content or media is required" },
        { status: 400 }
      );
    }

    // Validate and parse social account IDs
    if (
      socialAccountIdsJson == null ||
      typeof socialAccountIdsJson !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid request: socialAccountIds is required" },
        { status: 400 }
      );
    }
    let socialAccountIds: unknown;
    try {
      socialAccountIds = JSON.parse(socialAccountIdsJson);
    } catch {
      return NextResponse.json(
        { error: "Invalid socialAccountIds format" },
        { status: 400 }
      );
    }
    if (!Array.isArray(socialAccountIds) || socialAccountIds.length === 0) {
      return NextResponse.json(
        { error: "At least one account is required" },
        { status: 400 }
      );
    }
    logger.debug("Target accounts:", socialAccountIds.length);

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

    logger.debug("Account verification passed", accounts.map((a) => a.platformUsername));

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

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");

      mediaData.push({
        data: base64,
        mimeType: file.type,
      });
    }

    logger.debug("Media processed", { count: mediaData.length });

    // Create the post
    const postId = nanoid();
    logger.info("Creating post", { postId });

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
        logger.warn("Scheduled time in the past, posting immediately", scheduledFor.toISOString());
        scheduledFor = null;
      }

      const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000;
      if (scheduledFor && scheduledFor.getTime() > oneYearFromNow) {
        return NextResponse.json(
          { error: "Scheduled date cannot be more than 1 year in the future" },
          { status: 400 }
        );
      }

      if (scheduledFor) {
        logger.debug("Scheduled for", scheduledFor.toISOString());
      }
    }


    // Insert post (don't store media in DB, send in job data)
    try {
      await db.insert(post).values({
        id: postId,
        userId: session.user.id,
        content: content || "",
        mediaUrls: [], // We'll generate URLs after upload
        scheduledFor,
        status: scheduledFor ? "scheduled" : "publishing",
      });

      logger.debug("Post created", { postId, mediaCount: mediaData.length });
    } catch (postError) {
      logger.error("Failed to insert post", postError);
      throw new Error(
        `Failed to create post: ${
          postError instanceof Error ? postError.message : "Unknown error"
        }`
      );
    }

    // Create post targets
    const targets = [];
    for (const account of accounts) {
      const targetId = nanoid();

      targets.push({
        id: targetId,
        postId,
        socialAccountId: account.id,
        status: "pending" as const,
      });
    }

    // Insert all targets at once
    try {
      await db.insert(postTarget).values(targets);
      logger.debug("Post targets created", { count: targets.length });
    } catch (targetError) {
      logger.error("Failed to insert post targets", targetError);
      // Try to delete the post if targets failed
      try {
        await db.delete(post).where(eq(post.id, postId));
        logger.debug("Cleaned up post after target failure", { postId });
      } catch (cleanupError) {
        logger.error("Failed to cleanup post after target failure", cleanupError);
      }
      throw new Error(
        `Failed to create post targets: ${
          targetError instanceof Error ? targetError.message : "Unknown error"
        }`
      );
    }

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

      // Schedule or publish immediately
      if (scheduledFor && scheduledFor > new Date()) {
        jobPromises.push(schedulePost(jobData, scheduledFor));
      } else {
        jobPromises.push(publishPostNow(jobData));
      }
    }

    // Wait for all jobs to be queued
    await Promise.all(jobPromises);
    logger.info("Post created and jobs queued", {
      postId,
      targetCount: targets.length,
      mediaCount: mediaData.length,
    });

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
    logger.error("Error creating post", error);
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
