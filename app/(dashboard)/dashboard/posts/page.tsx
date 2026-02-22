// app/(dashboard)/dashboard/posts/page.tsx
import { auth } from "@/lib/auth";
import { db, post, postTarget, socialAccount } from "@/lib/db";
import { logger } from "@/lib/logger";
import { eq, desc, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PostsNotification } from "./notification";
import { ScheduledTime } from "./scheduled-time";
import { PostsClient } from "./posts-client";
import { PostsViewClient } from "./posts-view-client";

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

const headerMenu = [
  { label: "Overview", href: "/dashboard/posts" },
  { label: "Calendar", href: "/dashboard" },
  { label: "Accounts", href: "/dashboard/accounts" },
];

export default async function PostsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  const posts = await db.query.post.findMany({
    where: eq(post.userId, session.user.id),
    orderBy: desc(post.createdAt),
    limit: 50,
  });

  // Fetch all user's social accounts for the compose modal
  const allAccounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session.user.id),
    orderBy: desc(socialAccount.createdAt),
  });

  // Get targets for each post
  const postsWithTargets = await Promise.all(
    posts.map(async (p) => {
      try {
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
            account: accounts.find((a) => a.id === t.socialAccountId) ?? null,
          })),
        };
      } catch (error) {
        logger.error("Error fetching targets for post", { postId: p.id, error });
        // Return post without targets if query fails
        return {
          ...p,
          targets: [],
        };
      }
    })
  );

  const totalPosts = postsWithTargets.length;
  const publishedPosts = postsWithTargets.filter(
    (p) => p.status === "published"
  ).length;
  const scheduledPosts = postsWithTargets.filter(
    (p) => p.status === "scheduled"
  ).length;
  const failedPosts = postsWithTargets.filter(
    (p) => p.status === "failed"
  ).length;

  const totalTargets = postsWithTargets.reduce(
    (acc, p) => acc + p.targets.length,
    0
  );

  const targetStatusCounts = postsWithTargets.reduce<Record<string, number>>(
    (acc, p) => {
      p.targets.forEach((target) => {
        acc[target.status] = (acc[target.status] || 0) + 1;
      });
      return acc;
    },
    {}
  );

  const publishedTargets = targetStatusCounts["published"] || 0;
  const successRate =
    totalTargets === 0
      ? 0
      : Math.round((publishedTargets / totalTargets) * 100);
  const avgPlatformsPerPost =
    totalPosts === 0 ? "0" : (totalTargets / totalPosts).toFixed(1);

  const platformStats = postsWithTargets.reduce<
    Record<string, { count: number; published: number }>
  >((acc, p) => {
    p.targets.forEach((target) => {
      const platform = target.account?.platform || "unknown";
      if (!acc[platform]) {
        acc[platform] = { count: 0, published: 0 };
      }
      acc[platform].count += 1;
      if (target.status === "published") {
        acc[platform].published += 1;
      }
    });
    return acc;
  }, {});

  const platformEntries = Object.entries(platformStats).sort(
    (a, b) => b[1].count - a[1].count
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Section - Compact */}
      <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-r from-violet-600/5 via-white to-fuchsia-600/5 dark:from-violet-500/10 dark:via-zinc-950 dark:to-fuchsia-500/10 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                Posts & Performance
              </h1>
              <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {successRate}%
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  success
                </span>
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Track performance across platforms and manage your content
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PostsClient accounts={allAccounts} />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-white text-sm transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              <span>Dashboard</span>
              <span className="text-base">🗂️</span>
            </Link>
          </div>
        </div>

        {/* Navigation Tabs - Compact */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {headerMenu.map((item) => {
            const isActive = item.href === "/dashboard/posts";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "border-violet-500 bg-white text-violet-600 shadow-sm dark:bg-zinc-900 dark:text-violet-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <PostsNotification />

      {/* Stats Grid - Compact */}
      <section className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          {
            label: "Total posts",
            value: totalPosts,
            helper: `${scheduledPosts} scheduled`,
          },
          {
            label: "Published",
            value: publishedPosts,
            helper: `${successRate}% success rate`,
          },
          {
            label: "Failed jobs",
            value: failedPosts,
            helper:
              failedPosts === 0
                ? "All clear"
                : `${failedPosts} post${
                    failedPosts === 1 ? "" : "s"
                  } need attention`,
          },
          {
            label: "Avg. platforms/post",
            value: avgPlatformsPerPost,
            helper: `${platformEntries.length} active platforms`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {card.label}
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-white">
              {card.value}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {card.helper}
            </p>
          </div>
        ))}
      </section>

      {/* Analytics Section - Grouped */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
                Platform Performance
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {totalTargets} total targets
            </p>
            </div>
          </div>
          <div className="space-y-3">
            {platformEntries.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Connect a social account to start collecting platform insights.
              </p>
            )}
            {platformEntries.slice(0, 6).map(([platform, stats]) => {
              const completion =
                stats.count === 0
                  ? 0
                  : Math.round((stats.published / stats.count) * 100);
              return (
                <div key={platform}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {platformIcons[platform] || "🌐"}
                      </span>
                      <span className="capitalize text-zinc-900 dark:text-white">
                        {platform === "unknown" ? "Unknown platform" : platform}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {completion}% success • {stats.count} posts
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-violet-500"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-4">
            Status Distribution
          </h3>
          <div className="space-y-3">
            {["published", "scheduled", "publishing", "failed"].map(
              (status) => {
                const count = targetStatusCounts[status] || 0;
                const percentage =
                  totalTargets === 0
                    ? 0
                    : Math.round((count / totalTargets) * 100);
                const barColor =
                  status === "published"
                    ? "bg-green-500"
                    : status === "failed"
                    ? "bg-red-500"
                    : status === "publishing"
                    ? "bg-yellow-500"
                    : "bg-blue-500";
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="capitalize text-zinc-900 dark:text-white">
                        {status}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {count} targets • {percentage}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-2 rounded-full ${barColor}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Need higher success rates? Check{" "}
            <Link
              href="/dashboard/accounts"
              className="font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Accounts
            </Link>{" "}
            or clean failed jobs.
          </div>
        </div>
      </section>

      {/* Posts Section */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-4 sm:p-6">
        {postsWithTargets.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
              No posts yet
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Create your first post to get started
            </p>
            <Link
              href="/dashboard"
              className="inline-flex px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-medium rounded-lg transition"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <PostsViewClient posts={postsWithTargets} />
        )}
      </div>
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
