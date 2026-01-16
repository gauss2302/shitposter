// app/(dashboard)/dashboard/posts/page.tsx
import { auth } from "@/lib/auth";
import { db, post, postTarget, socialAccount } from "@/lib/db";
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
            account: accounts.find((a) => a.id === t.socialAccountId),
          })),
        };
      } catch (error) {
        console.error(`Error fetching targets for post ${p.id}:`, error);
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
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      <div className="rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-r from-violet-600/5 via-white to-fuchsia-600/5 dark:from-violet-500/10 dark:via-zinc-950 dark:to-fuchsia-500/10 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 md:gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
              Analytics overview
            </p>
            <h1 className="mt-1 md:mt-2 text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white">
              Posts & Performance
            </h1>
            <p className="mt-1 md:mt-2 text-sm md:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl">
              Track how your content performs across every platform, spot
              failures early, and jump straight into composing something new.
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="text-right">
              <p className="text-xs md:text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Success rate
              </p>
              <p className="text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-white">
                {successRate}%
              </p>
              <p className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400">
                {publishedTargets} / {totalTargets || 1} targets
              </p>
            </div>
            <div className="h-full border-l border-zinc-200 dark:border-zinc-800" />
            <div className="flex items-center gap-2 md:gap-3">
              <PostsClient accounts={allAccounts} />
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 md:gap-2 rounded-lg md:rounded-xl bg-zinc-900 px-3 md:px-4 py-1.5 md:py-2 text-white text-xs md:text-sm transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
              >
                <span>Dashboard</span>
                <span className="text-base md:text-lg">🗂️</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {headerMenu.map((item) => {
            const isActive = item.href === "/dashboard/posts";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
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

      <section className="grid gap-2 md:gap-3 grid-cols-2 md:grid-cols-4">
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
            className="rounded-xl md:rounded-2xl border border-zinc-200 bg-white p-3 md:p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-xs md:text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {card.label}
            </p>
            <p className="mt-1 md:mt-2 text-2xl md:text-3xl font-semibold text-zinc-900 dark:text-white">
              {card.value}
            </p>
            <p className="mt-0.5 md:mt-1 text-xs md:text-sm text-zinc-500 dark:text-zinc-400">
              {card.helper}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Platform performance
              </p>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Where you publish
              </h2>
            </div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {totalTargets} total targets
            </span>
          </div>
          <div className="mt-4 space-y-4">
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
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Status distribution
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
            Target health
          </h3>
          <div className="mt-4 space-y-4">
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
          <div className="mt-6 rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Need higher success rates? Double-check tokens in{" "}
            <Link
              href="/dashboard/accounts"
              className="font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              Accounts
            </Link>{" "}
            or clean failed jobs in the queue.
          </div>
        </div>
      </section>

      {postsWithTargets.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-8 md:p-12 border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full mx-auto mb-3 md:mb-4 flex items-center justify-center">
            <span className="text-2xl md:text-3xl">📝</span>
          </div>
          <h2 className="text-base md:text-lg font-semibold text-zinc-900 dark:text-white mb-2">
            No posts yet
          </h2>
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mb-3 md:mb-4">
            Create your first post to get started
          </p>
          <Link
            href="/dashboard"
            className="inline-flex px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm md:text-base font-medium rounded-lg transition"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <PostsViewClient posts={postsWithTargets} />
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
