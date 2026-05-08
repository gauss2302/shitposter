import { redirect } from "next/navigation";
import Link from "next/link";
import { PostsNotification } from "./notification";
import { PostsClient } from "./posts-client";
import { PostsViewClient } from "./posts-view-client";
import { PlatformIcon, platformLabel } from "@/app/ui/platform-icon";
import {
  ApiUnauthorizedError,
  getBackendSession,
  getDashboardPosts,
} from "@/lib/api/server";

const headerMenu = [
  { label: "Overview", href: "/dashboard/posts" },
  { label: "Calendar", href: "/dashboard" },
  { label: "Accounts", href: "/dashboard/accounts" },
];

export default async function PostsPage() {
  let data;
  try {
    const [session, posts] = await Promise.all([
      getBackendSession(),
      getDashboardPosts(),
    ]);
    if (!session.user) redirect("/sign-in");
    data = posts;
  } catch (error) {
    if (error instanceof ApiUnauthorizedError) redirect("/sign-in");
    throw error;
  }

  const postsWithTargets = data.posts;
  const composeAccounts = data.accounts.filter(
    (account) =>
      account.platform === "twitter" || account.platform === "linkedin"
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
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="rounded-lg border border-border-subtle bg-surface-2 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">
                Posts &amp; performance
              </h1>
              <span className="hidden items-center gap-2 rounded-pill border border-border-subtle bg-surface-1 px-3 py-1 sm:inline-flex">
                <span className="text-sm font-semibold text-ink nums">
                  {successRate}%
                </span>
                <span className="text-xs text-muted">success</span>
              </span>
            </div>
            <p className="text-sm text-muted">
              Track performance across platforms and manage your content.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PostsClient accounts={composeAccounts} />
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-1"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Posts views"
          className="mt-4 flex flex-wrap gap-1.5"
        >
          {headerMenu.map((item) => {
            const isActive = item.href === "/dashboard/posts";
            return (
              <Link
                role="tab"
                aria-selected={isActive}
                key={item.href}
                href={item.href}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-border bg-surface-2 text-ink shadow-sm"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <PostsNotification />

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                : `${failedPosts} post${failedPosts === 1 ? "" : "s"} need attention`,
          },
          {
            label: "Avg. platforms/post",
            value: avgPlatformsPerPost,
            helper: `${platformEntries.length} active platforms`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-md border border-border-subtle bg-surface-2 p-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink nums tracking-[-0.02em]">
              {card.value}
            </p>
            <p className="mt-0.5 text-xs text-muted">{card.helper}</p>
          </div>
        ))}
      </section>

      {/* Analytics */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-border-subtle bg-surface-2 p-4 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">
                Platform performance
              </h2>
              <p className="mt-0.5 text-xs text-muted nums">
                {totalTargets} total targets
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {platformEntries.length === 0 && (
              <p className="text-sm text-muted">
                Connect a social account to start collecting platform
                insights.
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
                    <div className="flex items-center gap-2 text-ink">
                      <PlatformIcon platform={platform} size={16} />
                      <span className="capitalize">
                        {platform === "unknown"
                          ? "Unknown platform"
                          : platformLabel(platform)}
                      </span>
                    </div>
                    <span className="text-xs text-muted nums">
                      {completion}% success • {stats.count} posts
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-pill bg-surface-1">
                    <div
                      className="h-1.5 rounded-pill bg-primary"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-2 p-4">
          <h3 className="mb-4 text-base font-semibold tracking-[-0.01em] text-ink">
            Status distribution
          </h3>
          <div className="space-y-4">
            {["published", "scheduled", "publishing", "failed"].map((status) => {
              const count = targetStatusCounts[status] || 0;
              const percentage =
                totalTargets === 0
                  ? 0
                  : Math.round((count / totalTargets) * 100);
              const barClass =
                status === "published"
                  ? "bg-success"
                  : status === "failed"
                    ? "bg-danger"
                    : status === "publishing"
                      ? "bg-warning"
                      : "bg-primary";
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize text-ink">{status}</span>
                    <span className="text-xs text-muted nums">
                      {count} targets • {percentage}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-pill bg-surface-1">
                    <div
                      className={`h-1.5 rounded-pill ${barClass}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-md border border-dashed border-border-subtle p-3 text-xs text-muted">
            Need higher success rates? Check{" "}
            <Link
              href="/dashboard/accounts"
              className="font-medium text-primary hover:underline"
            >
              Accounts
            </Link>{" "}
            or clean failed jobs.
          </div>
        </div>
      </section>

      {/* Posts list */}
      <div className="rounded-md border border-border-subtle bg-surface-2 p-4 sm:p-6">
        {postsWithTargets.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-md bg-surface-1 text-muted">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4 4h16v16H4z" />
                <path d="M4 9h16M9 4v16" />
              </svg>
            </div>
            <h2 className="mb-1 text-base font-semibold text-ink">
              No posts yet
            </h2>
            <p className="mb-5 text-sm text-muted">
              Create your first post to get started.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-on transition-colors hover:bg-primary-hover"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <PostsViewClient posts={postsWithTargets} />
        )}
      </div>
    </div>
  );
}
