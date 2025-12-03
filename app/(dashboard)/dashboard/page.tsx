import { auth } from "@/lib/auth";
import { db, socialAccount, post } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { DashboardHeader } from "./components/dashboard-header";
import { QuickActions } from "./components/quick-actions";
import { EmptyState } from "./components/empty-state";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Fetch user's connected accounts
  const accounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session!.user.id),
    orderBy: desc(socialAccount.createdAt),
  });

  // Fetch recent posts (increased limit for calendar view)
  const recentPosts = await db.query.post.findMany({
    where: eq(post.userId, session!.user.id),
    orderBy: desc(post.createdAt),
    limit: 50, // Increased to show more posts in calendar
  });

  const stats = {
    connectedAccounts: accounts.length,
    scheduledPosts: recentPosts.filter((p) => p.status === "scheduled").length,
    publishedPosts: recentPosts.filter((p) => p.status === "published").length,
  };

  return (
    <div className="min-h-screen bg-[#F5F7FF]">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
        <DashboardHeader
          name={session!.user.name}
          email={session!.user.email}
          avatarUrl={session!.user.image}
          stats={stats}
          accounts={accounts}
          posts={recentPosts}
        />

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              title: "Connected Accounts",
              value: stats.connectedAccounts,
              icon: "🔗",
              href: "/dashboard/accounts",
              accent: "from-[#D8E6FF] to-white",
              description: "Where your chaos is syndicated.",
            },
            {
              title: "Scheduled Posts",
              value: stats.scheduledPosts,
              icon: "📅",
              href: null, // Will open modal instead
              accent: "from-[#FFEBD3] to-white",
              description: "Locked and loaded for later.",
            },
            {
              title: "Published This Week",
              value: stats.publishedPosts,
              icon: "📊",
              href: "/dashboard/posts",
              accent: "from-[#E8FFF4] to-white",
              description: "Already unleashed into the feed.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-3xl border border-[#E8F0FF] bg-white p-6 shadow-xl shadow-[#C4D9FF]/15"
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-linear-to-br ${card.accent} flex items-center justify-center text-2xl mb-6`}
              >
                {card.icon}
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-400">
                {card.title}
              </p>
              <p className="mt-3 text-4xl font-black text-zinc-900">
                {card.value}
              </p>
              <p className="mt-2 text-sm text-zinc-500">{card.description}</p>
              {card.href && (
                <Link
                  href={card.href}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#566BFF] hover:text-[#3947ff] transition-colors"
                >
                  Manage →
                </Link>
              )}
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-[#E8F0FF] bg-white p-8 shadow-xl shadow-[#C4D9FF]/15">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">
                  Latest Activity
                </h2>
                <p className="text-sm text-zinc-500">
                  Track drafts, scheduled drops, and published wins.
                </p>
              </div>
              <Link
                href="/dashboard/posts"
                className="text-sm font-semibold text-[#566BFF] hover:text-[#3947ff]"
              >
                View all
              </Link>
            </div>
            {recentPosts.length ? (
              <div className="space-y-4">
                {recentPosts.slice(0, 5).map((recentPost) => (
                  <div
                    key={recentPost.id}
                    className="rounded-2xl border border-[#EEF2FF] bg-[#F9FAFF] p-5 hover:border-[#d4dcff] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">
                          {recentPost.status}
                        </p>
                        <p className="mt-2 font-bold text-zinc-900 text-sm leading-relaxed max-h-16 overflow-hidden">
                          {recentPost.content}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#566BFF] shadow-sm">
                        {recentPost.scheduledFor
                          ? `Scheduled ${recentPost.scheduledFor.toLocaleDateString()}`
                          : `Posted ${recentPost.createdAt.toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState accounts={accounts} posts={recentPosts} />
            )}
          </div>

          <div className="rounded-3xl border border-[#E8F0FF] bg-white p-8 shadow-xl shadow-[#C4D9FF]/15">
            <h2 className="text-xl font-bold text-zinc-900 mb-4">
              Quick Actions
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Launch a post or connect another megaphone.
            </p>
            <QuickActions accounts={accounts} posts={recentPosts} />
          </div>
        </section>

        {/* Connected Accounts */}
        <section className="rounded-3xl border border-[#E8F0FF] bg-white p-8 shadow-xl shadow-[#C4D9FF]/15">
          <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">
                Connected Accounts
              </h2>
              <p className="text-sm text-zinc-500">
                Your megaphones across the internet.
              </p>
            </div>
            <Link
              href="/dashboard/accounts"
              className="text-sm font-semibold text-[#566BFF] hover:text-[#3947ff]"
            >
              Manage connections
            </Link>
          </div>
          {accounts.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-4 rounded-2xl border border-[#EEF2FF] bg-[#FBFBFF] p-4 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-white border border-[#E8F0FF] flex items-center justify-center text-xl">
                    {account.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.profileImageUrl}
                        alt={`${account.platform} avatar`}
                        className="w-full h-full rounded-xl object-cover"
                      />
                    ) : (
                      platformIcon(account.platform)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-900 truncate">
                      @{account.platformUsername}
                    </p>
                    <p className="text-sm text-zinc-500 capitalize">
                      {account.platform}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      account.isActive
                        ? "bg-[#E8FFF4] text-[#0FAD5B]"
                        : "bg-[#FEE2E2] text-[#B91C1C]"
                    }`}
                  >
                    {account.isActive ? "Active" : "Offline"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#C5BAFF] bg-[#F5F7FF] p-12 text-center">
              <p className="text-lg font-semibold text-zinc-900 mb-2">
                No accounts connected
              </p>
              <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
                Plug in a Twitter, TikTok, or LinkedIn account to start firing
                off cross-platform shitposts.
              </p>
              <Link
                href="/dashboard/accounts"
                className="inline-flex px-8 py-4 rounded-2xl bg-[#566BFF] text-white font-semibold shadow-lg shadow-[#566BFF]/30"
              >
                Connect your first account
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function platformIcon(platform: string) {
  if (platform === "twitter") return "𝕏";
  if (platform === "instagram") return "📸";
  if (platform === "tiktok") return "🎵";
  if (platform === "linkedin") return "💼";
  return "🌐";
}
