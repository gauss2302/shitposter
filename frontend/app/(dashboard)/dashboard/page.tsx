import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardSummary, isApiUnauthorizedError } from "@/lib/api/server";
import { DashboardHeader } from "./components/dashboard-header";
import { QuickActions } from "./components/quick-actions";
import { DashboardContent } from "./components/dashboard-content";
import {
  LinkIcon,
  CalendarIcon,
  TrendingUpIcon,
  BarChartIcon,
} from "@/app/ui/dashboard-icons";

export default async function DashboardPage() {
  let summary;
  try {
    summary = await getDashboardSummary();
  } catch (error) {
    if (isApiUnauthorizedError(error)) redirect("/sign-in");
    throw error;
  }

  const { user: sessionUser, accounts, posts: recentPosts, stats } = summary;

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-7xl px-2 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        <DashboardHeader
          name={sessionUser.name}
          email={sessionUser.email}
          avatarUrl={sessionUser.image}
          stats={stats}
        />

        {/* Top Row: Stats & Quick Actions */}
        <section className="grid grid-cols-2 gap-2 md:gap-3 md:grid-cols-4 xl:grid-cols-5">
          {[
            {
              title: "Connected Accounts",
              value: stats.connectedAccounts,
              Icon: LinkIcon,
              href: "/dashboard/accounts",
            },
            {
              title: "Scheduled Posts",
              value: stats.scheduledPosts,
              Icon: CalendarIcon,
              href: null,
            },
            {
              title: "Published This Week",
              value: stats.publishedPosts,
              Icon: BarChartIcon,
              href: "/dashboard/posts",
            },
            {
              title: "Twitter Analytics",
              value: accounts.filter(
                (a) => a.platform === "twitter" && a.isActive
              ).length,
              Icon: TrendingUpIcon,
              href: "/dashboard/analytics",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="flex flex-col justify-between rounded-md md:rounded-lg border border-border-subtle bg-surface-2 p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-2 md:mb-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-surface-1 text-ink flex items-center justify-center">
                    <card.Icon size={18} />
                  </div>
                  {card.href && (
                    <Link
                      href={card.href}
                      className="text-[10px] md:text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                    >
                      Manage
                    </Link>
                  )}
                </div>
                <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {card.title}
                </p>
                <p className="mt-0.5 md:mt-1 text-2xl md:text-3xl font-semibold text-ink nums">
                  {card.value}
                </p>
              </div>
            </div>
          ))}

          {/* Quick Actions Card */}
          <div className="col-span-2 md:col-span-4 xl:col-span-1 rounded-md md:rounded-lg border border-border-subtle bg-surface-2 p-3 md:p-4 shadow-sm flex flex-col justify-center">
            <p className="mb-3 text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              Quick actions
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
