import { auth } from "@/lib/auth";
import { db, socialAccount, post } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "./components/dashboard-header";
import { QuickActions } from "./components/quick-actions";
import { EmptyState } from "./components/empty-state";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  // Fetch user's connected accounts
  const accounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session.user.id),
    orderBy: desc(socialAccount.createdAt),
  });

  // Fetch recent posts (increased limit for calendar view)
  const recentPosts = await db.query.post.findMany({
    where: eq(post.userId, session.user.id),
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
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <DashboardHeader
          name={session.user.name}
          email={session.user.email}
          avatarUrl={session.user.image}
          stats={stats}
          accounts={accounts} // ← Add this
        />

        {/* Top Row: Stats & Quick Actions */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
          {[
            {
              title: "Connected Accounts",
              value: stats.connectedAccounts,
              icon: "🔗",
              href: "/dashboard/accounts",
              accent: "from-[#D8E6FF] to-white",
            },
            {
              title: "Scheduled Posts",
              value: stats.scheduledPosts,
              icon: "📅",
              href: null, // Will open modal instead
              accent: "from-[#FFEBD3] to-white",
            },
            {
              title: "Published This Week",
              value: stats.publishedPosts,
              icon: "📊",
              href: "/dashboard/posts",
              accent: "from-[#E8FFF4] to-white",
            },
            {
              title: "Twitter Analytics",
              value: accounts.filter(
                (a) => a.platform === "twitter" && a.isActive
              ).length,
              icon: "📈",
              href: "/dashboard/analytics",
              accent: "from-[#E0E7FF] to-white",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="flex flex-col justify-between rounded-2xl border border-[#E8F0FF] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl bg-linear-to-br ${card.accent} flex items-center justify-center text-lg`}
                  >
                    {card.icon}
                  </div>
                  {card.href && (
                    <Link
                      href={card.href}
                      className="text-xs font-bold text-[#566BFF] hover:text-[#3947ff] transition-colors"
                    >
                      Manage
                    </Link>
                  )}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {card.title}
                </p>
                <p className="mt-1 text-3xl font-black text-zinc-900">
                  {card.value}
                </p>
              </div>
            </div>
          ))}

          {/* Quick Actions Card */}
          <div className="col-span-2 md:col-span-4 xl:col-span-1 rounded-2xl border border-[#E8F0FF] bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Quick Actions
            </p>
            <QuickActions />
          </div>
        </section>

        {/* Main Content: Activity & Accounts */}
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          {/* Latest Activity */}
          <div className="rounded-3xl border border-[#E8F0FF] bg-white p-6 shadow-xl shadow-[#C4D9FF]/15">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
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
              <div className="space-y-3">
                {recentPosts.slice(0, 5).map((recentPost) => (
                  <div
                    key={recentPost.id}
                    className="rounded-xl border border-[#EEF2FF] bg-[#F9FAFF] p-4 hover:border-[#d4dcff] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                          {recentPost.status}
                        </p>
                        <p className="mt-1 font-bold text-zinc-900 text-sm leading-relaxed max-h-12 overflow-hidden">
                          {recentPost.content}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#566BFF] shadow-sm border border-[#EEF2FF]">
                        {recentPost.scheduledFor
                          ? `Scheduled ${recentPost.scheduledFor.toLocaleDateString()}`
                          : `Posted ${recentPost.createdAt.toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState accounts={accounts} />
            )}
          </div>

          {/* Connected Accounts List */}
          <div className="rounded-3xl border border-[#E8F0FF] bg-white p-6 shadow-xl shadow-[#C4D9FF]/15 h-fit">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  Connected Accounts
                </h2>
                <p className="text-sm text-zinc-500">Your active megaphones.</p>
              </div>
              <Link
                href="/dashboard/accounts"
                className="text-sm font-semibold text-[#566BFF] hover:text-[#3947ff]"
              >
                Manage
              </Link>
            </div>
            {accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 rounded-xl border border-[#EEF2FF] bg-[#FBFBFF] p-3 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white border border-[#E8F0FF] flex items-center justify-center text-lg shrink-0">
                      {account.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.profileImageUrl}
                          alt={`${account.platform} avatar`}
                          className="w-full h-full rounded-lg object-cover"
                        />
                      ) : (
                        platformIcon(account.platform)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 text-sm truncate">
                        @{account.platformUsername}
                      </p>
                      <p className="text-xs text-zinc-500 capitalize">
                        {account.platform}
                      </p>
                    </div>
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        account.isActive ? "bg-[#0FAD5B]" : "bg-[#B91C1C]"
                      }`}
                      title={account.isActive ? "Active" : "Offline"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-zinc-500 mb-4">
                  No accounts connected yet.
                </p>
                <Link
                  href="/dashboard/accounts"
                  className="inline-flex px-4 py-2 rounded-xl bg-[#566BFF] text-white text-sm font-semibold shadow-lg shadow-[#566BFF]/30"
                >
                  Connect Account
                </Link>
              </div>
            )}
          </div>
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
