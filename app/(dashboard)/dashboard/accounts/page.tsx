import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { AccountsClient } from "./accounts-client";
import { LogoutButton } from "@/app/ui/logout-button";

export default async function AccountsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const accounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session!.user.id),
    orderBy: desc(socialAccount.createdAt),
  });

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((account) => account.isActive).length;
  const platformsConnected = new Set(accounts.map((account) => account.platform))
    .size;
  const needsAttention = accounts.filter((account) => !account.isActive).length;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200/70 bg-gradient-to-br from-white via-white to-violet-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
              Accounts
            </p>
            <h1 className="text-3xl font-bold text-zinc-900">
              Connected Platforms
            </h1>
            <p className="text-zinc-500">
              Add, audit, and disconnect social profiles in one tidy view.
            </p>
          </div>
          <LogoutButton />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Accounts",
              value: totalAccounts,
              helper: `${platformsConnected} platforms`,
            },
            {
              label: "Active",
              value: activeAccounts,
              helper: `${Math.round(
                totalAccounts === 0
                  ? 0
                  : (activeAccounts / totalAccounts) * 100
              )}% ready`,
            },
            {
              label: "Needs attention",
              value: needsAttention,
              helper:
                needsAttention === 0
                  ? "All synced"
                  : "Reconnect to keep posting",
            },
            {
              label: "Last added",
              value:
                accounts[0]?.createdAt.toLocaleDateString() ?? "No accounts",
              helper: accounts[0]?.platformUsername
                ? `@${accounts[0].platformUsername}`
                : "—",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-xs"
            >
              <p className="font-semibold text-zinc-900">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {card.value}
              </p>
              <p className="mt-1">{card.helper}</p>
            </div>
          ))}
        </div>
      </div>

      <AccountsClient accounts={accounts} />
    </div>
  );
}
