import { redirect } from "next/navigation";
import Link from "next/link";
import { TwitterAnalytics } from "./twitter-analytics";
import { LogoutButton } from "@/app/ui/logout-button";
import {
  ApiUnauthorizedError,
  getBackendSession,
  getDashboardAccounts,
} from "@/lib/server-api";

export default async function AnalyticsPage() {
  let allAccounts;
  try {
    const [session, accounts] = await Promise.all([
      getBackendSession(),
      getDashboardAccounts(),
    ]);
    if (!session.user) redirect("/sign-in");
    allAccounts = accounts;
  } catch (error) {
    if (error instanceof ApiUnauthorizedError) redirect("/sign-in");
    throw error;
  }

  const twitterAccounts = allAccounts.filter(
    (account) => account.platform === "twitter" && account.isActive
  );

  const totalFollowers = twitterAccounts.reduce(
    (sum, acc) => sum + (acc.followerCount || 0),
    0
  );

  const activeAccountsCount = twitterAccounts.length;

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
              X Analytics
            </h1>
            <p className="text-zinc-500">
              Analytics are currently available for connected X accounts only.
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
            label: "Active X Accounts",
            value: activeAccountsCount,
            helper:
              activeAccountsCount === 1 ? "1 connected account" : "Connected accounts",
            color: "from-blue-50 to-blue-100",
          },
          {
            label: "Estimated Audience",
            value: totalFollowers,
            helper: "Across connected X accounts",
            color: "from-violet-50 to-violet-100",
          },
          {
            label: "API Dependency",
            value: twitterAccounts.length > 0 ? "Live" : "Idle",
            helper: "This view depends on X API access",
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
              {typeof stat.value === "number"
                ? stat.value.toLocaleString()
                : stat.value}
            </p>
            <p className="text-sm text-zinc-600">{stat.helper}</p>
          </div>
        ))}
      </div>

      {twitterAccounts.length > 0 ? (
        <section className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b border-zinc-200">
            <span className="text-2xl">𝕏</span>
            <h2 className="text-xl font-bold text-zinc-900">
              Account Performance
            </h2>
          </div>
          <div className="space-y-8">
            {twitterAccounts.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-2xl border border-zinc-200 p-6"
              >
                <TwitterAnalytics account={account} />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <h2 className="text-lg font-bold text-zinc-900">
            Connect X to unlock analytics
          </h2>
          <p className="mt-2 text-zinc-500">
            Other analytics views were removed until they can be implemented
            with reliable production data.
          </p>
        </div>
      )}

      {/* Empty State / Connect More */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center">
        <h3 className="text-lg font-bold text-zinc-900 mb-2">
          Manage account connections
        </h3>
        <p className="text-zinc-500 mb-6">
          X analytics stay available only while X API access is enabled.
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
