// app/(dashboard)/dashboard/posts/page.tsx
import { auth } from "@/lib/auth";
import { db, post, postTarget, socialAccount } from "@/lib/db";
import { eq, desc, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { PostsNotification } from "./notification";

const platformIcons: Record<string, string> = {
  twitter: "𝕏",
  instagram: "📸",
  tiktok: "🎵",
  linkedin: "💼",
  facebook: "📘",
  threads: "🧵",
};

const statusColors: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  publishing:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  published:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default async function PostsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const posts = await db.query.post.findMany({
    where: eq(post.userId, session!.user.id),
    orderBy: desc(post.createdAt),
    limit: 50,
  });

  // Get targets for each post
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

  return (
    <div className="space-y-6">
      <PostsNotification />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Your Posts
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            View and manage all your scheduled and published posts
          </p>
        </div>
        <Link
          href="/dashboard/compose"
          className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-lg transition"
        >
          Create Post
        </Link>
      </div>

      {postsWithTargets.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-12 border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">📝</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            No posts yet
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            Create your first post to get started
          </p>
          <Link
            href="/dashboard/compose"
            className="inline-flex px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-lg transition"
          >
            Create Post
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {postsWithTargets.map((postItem) => (
            <div
              key={postItem.id}
              className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 transition"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        statusColors[postItem.status] || statusColors.draft
                      }`}
                    >
                      {postItem.status}
                    </span>
                    {postItem.scheduledFor && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {postItem.status === "scheduled"
                          ? `Scheduled for ${postItem.scheduledFor.toLocaleString()}`
                          : `Was scheduled for ${postItem.scheduledFor.toLocaleString()}`}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-900 dark:text-white leading-relaxed">
                    {postItem.content}
                  </p>
                </div>
              </div>

              {/* Targets */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                  Publishing To
                </p>
                <div className="flex flex-wrap gap-2">
                  {postItem.targets.map((target) => (
                    <div
                      key={target.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        target.status === "published"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                          : target.status === "failed"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          : target.status === "publishing"
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                          : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      <span className="text-lg">
                        {target.account
                          ? platformIcons[target.account.platform] || "🌐"
                          : "❓"}
                      </span>
                      <div className="text-xs">
                        <p className="font-semibold text-zinc-900 dark:text-white">
                          @{target.account?.platformUsername || "Unknown"}
                        </p>
                        <p
                          className={
                            target.status === "published"
                              ? "text-green-600 dark:text-green-400"
                              : target.status === "failed"
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-500 dark:text-zinc-400"
                          }
                        >
                          {target.status}
                        </p>
                      </div>
                      {target.platformPostId && (
                        <a
                          href={getPlatformUrl(
                            target.account?.platform || "",
                            target.account?.platformUsername || "",
                            target.platformPostId
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {postItem.targets.some((t) => t.errorMessage) && (
                  <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">
                      Errors:
                    </p>
                    {postItem.targets
                      .filter((t) => t.errorMessage)
                      .map((t) => (
                        <p
                          key={t.id}
                          className="text-xs text-red-600 dark:text-red-400"
                        >
                          • {t.account?.platformUsername}: {t.errorMessage}
                        </p>
                      ))}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>Created {postItem.createdAt.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getPlatformUrl(
  platform: string,
  username: string,
  postId: string
): string {
  switch (platform) {
    case "twitter":
      return `https://twitter.com/${username}/status/${postId}`;
    case "instagram":
      return `https://www.instagram.com/p/${postId}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${username}/video/${postId}`;
    case "linkedin":
      return `https://www.linkedin.com/feed/update/${postId}`;
    default:
      return "#";
  }
}
