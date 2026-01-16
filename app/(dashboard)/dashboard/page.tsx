import { auth } from "@/lib/auth";
import { db, socialAccount, post } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { DashboardHeader } from "./components/dashboard-header";
import { QuickActions } from "./components/quick-actions";
import { EmptyState } from "./components/empty-state";
import { DashboardContent } from "./components/dashboard-content";

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
      <div className="mx-auto max-w-7xl px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <DashboardHeader
          name={session.user.name}
          email={session.user.email}
          avatarUrl={session.user.image}
          stats={stats}
          accounts={accounts}
        />

        {/* Top Row: Stats & Quick Actions */}
        <section className="grid grid-cols-2 gap-2 md:gap-3 md:grid-cols-4 xl:grid-cols-5">
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
              className="flex flex-col justify-between rounded-xl md:rounded-2xl border border-[#E8F0FF] bg-white p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-linear-to-br ${card.accent} flex items-center justify-center text-base md:text-lg`}
                  >
                    {card.icon}
                  </div>
                  {card.href && (
                    <Link
                      href={card.href}
                      className="text-[10px] md:text-xs font-bold text-[#566BFF] hover:text-[#3947ff] transition-colors"
                    >
                      Manage
                    </Link>
                  )}
                </div>
                <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {card.title}
                </p>
                <p className="mt-0.5 md:mt-1 text-2xl md:text-3xl font-black text-zinc-900">
                  {card.value}
                </p>
              </div>
            </div>
          ))}

          {/* Quick Actions Card */}
          <div className="col-span-2 md:col-span-4 xl:col-span-1 rounded-xl md:rounded-2xl border border-[#E8F0FF] bg-white p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-center">
            <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2 md:mb-3">
              Quick Actions
            </p>
            <QuickActions />
          </div>
        </section>

        {/* Main Content: Activity & Accounts */}
        <DashboardContent posts={recentPosts} accounts={accounts} />
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
