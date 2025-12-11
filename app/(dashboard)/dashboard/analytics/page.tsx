import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TwitterAnalytics } from "./twitter-analytics";
import { LinkedInAnalytics } from "./linkedin-analytics";
import { InstagramAnalytics } from "./instagram-analytics";
import { TikTokAnalytics } from "./tiktok-analytics";
import { LogoutButton } from "@/app/ui/logout-button";

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  // Fetch all connected accounts
  const allAccounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session.user.id),
    orderBy: desc(socialAccount.createdAt),
  });

  const accountsByPlatform = {
    twitter: allAccounts.filter((a) => a.platform === "twitter" && a.isActive),
    linkedin: allAccounts.filter(
      (a) => a.platform === "linkedin" && a.isActive
    ),
    instagram: allAccounts.filter(
      (a) => a.platform === "instagram" && a.isActive
    ),
    tiktok: allAccounts.filter((a) => a.platform === "tiktok" && a.isActive),
  };

  const totalFollowers = allAccounts.reduce(
    (sum, acc) => sum + (acc.followerCount || 0),
    0
  );

  const activeAccountsCount = allAccounts.filter((a) => a.isActive).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-200/70 bg-linear-to-br from-white via-white to-violet-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
              Analytics
            </p>
            <h1 className="text-3xl font-bold text-zinc-900">
              Cross-Platform Performance
            </h1>
            <p className="text-zinc-500">
              Track your growth across Twitter, LinkedIn, Instagram, and TikTok
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-zinc-300 text-zinc-700 font-semibold rounded-lg hover:bg-zinc-50 transition"
            >
              ← Back to Dashboard
            </Link>
            <LogoutButton />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Connected Accounts",
            value: allAccounts.length,
            helper: `${activeAccountsCount} active`,
            color: "from-blue-50 to-blue-100",
          },
          {
            label: "Total Audience",
            value: totalFollowers,
            helper: "Across all platforms",
            color: "from-violet-50 to-violet-100",
          },
          {
            label: "Platforms Active",
            value: Object.values(accountsByPlatform).filter(
              (list) => list.length > 0
            ).length,
            helper: "Out of 4 supported",
            color: "from-green-50 to-green-100",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`bg-linear-to-br ${stat.color} rounded-2xl p-6 border border-zinc-200`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-2">
              {stat.label}
            </p>
            <p className="text-3xl font-bold text-zinc-900 mb-1">
              {stat.value.toLocaleString()}
            </p>
            <p className="text-sm text-zinc-600">{stat.helper}</p>
          </div>
        ))}
      </div>

      {/* Twitter Analytics */}
      {accountsByPlatform.twitter.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-zinc-200">
            <span className="text-2xl">𝕏</span>
            <h2 className="text-xl font-bold text-zinc-900">
              Twitter Analytics
            </h2>
          </div>
          <div className="space-y-8">
            {accountsByPlatform.twitter.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-2xl border border-zinc-200 p-6"
              >
                <TwitterAnalytics account={account} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LinkedIn Analytics */}
      {accountsByPlatform.linkedin.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-zinc-200">
            <span className="text-2xl text-blue-600">👔</span>
            <h2 className="text-xl font-bold text-zinc-900">
              LinkedIn Analytics
            </h2>
          </div>
          <div className="space-y-8">
            {accountsByPlatform.linkedin.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-2xl border border-zinc-200 p-6"
              >
                <LinkedInAnalytics account={account} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Instagram Analytics */}
      {accountsByPlatform.instagram.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-zinc-200">
            <span className="text-2xl">📸</span>
            <h2 className="text-xl font-bold text-zinc-900">
              Instagram Analytics
            </h2>
          </div>
          <div className="space-y-8">
            {accountsByPlatform.instagram.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-2xl border border-zinc-200 p-6"
              >
                <InstagramAnalytics account={account} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TikTok Analytics */}
      {accountsByPlatform.tiktok.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-zinc-200">
            <span className="text-2xl">🎵</span>
            <h2 className="text-xl font-bold text-zinc-900">
              TikTok Analytics
            </h2>
          </div>
          <div className="space-y-8">
            {accountsByPlatform.tiktok.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-2xl border border-zinc-200 p-6"
              >
                <TikTokAnalytics account={account} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State / Connect More */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center">
        <h3 className="text-lg font-bold text-zinc-900 mb-2">
          Connect More Accounts
        </h3>
        <p className="text-zinc-500 mb-6">
          Add more platforms to see all your analytics in one place.
        </p>
        <Link
          href="/dashboard/accounts"
          className="inline-flex px-6 py-3 bg-linear-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl transition shadow-lg"
        >
          Manage Connections
        </Link>
      </div>
    </div>
  );
}
