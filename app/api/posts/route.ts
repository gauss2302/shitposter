import { eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, post, postTarget, socialAccount } from "@/lib/db";
import { schedulePost, publishPostNow } from "@/lib/queue/queues";

const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  mediaUrls: z.array(z.string().url()).optional(),
  socialAccountIds: z.array(z.string()).min(1),
  scheduledFor: z.string().datetime().optional(), // ISO string
});

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createPostSchema.parse(body);

    // Verify all social accounts belong to the user
    const accounts = await db.query.socialAccount.findMany({
      where: (sa, { and, eq: eqOp, inArray: inArrayOp }) =>
        and(
          eqOp(sa.userId, session.user.id),
          inArrayOp(sa.id, data.socialAccountIds)
        ),
    });

    if (accounts.length !== data.socialAccountIds.length) {
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

    // Create the post
    const postId = nanoid();
    const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : null;

    await db.insert(post).values({
      id: postId,
      userId: session.user.id,
      content: data.content,
      mediaUrls: data.mediaUrls || [],
      scheduledFor,
      status: scheduledFor ? "scheduled" : "publishing",
    });

    // Create post targets and queue jobs
    const targets = [];
    for (const account of accounts) {
      const targetId = nanoid();

      targets.push({
        id: targetId,
        postId,
        socialAccountId: account.id,
        status: "pending",
      });

      const jobData = {
        postId,
        userId: session.user.id,
        targetId,
        socialAccountId: account.id,
        content: data.content,
        mediaUrls: data.mediaUrls,
      };

      // Schedule or publish immediately
      if (scheduledFor && scheduledFor > new Date()) {
        await schedulePost(jobData, scheduledFor);
      } else {
        await publishPostNow(jobData);
      }
    }

    await db.insert(postTarget).values(targets);

    return NextResponse.json({
      success: true,
      post: {
        id: postId,
        status: scheduledFor ? "scheduled" : "publishing",
        scheduledFor: scheduledFor?.toISOString(),
        targetCount: targets.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error._zod.output },
        { status: 400 }
      );
    }

    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}

// GET - List posts for the current user
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

  // Get targets for each post
  const postsWithTargets = await Promise.all(
    posts.map(async (p) => {
      const targets = await db.query.postTarget.findMany({
        where: eq(postTarget.postId, p.id),
      });

      // Get account info for each target
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
