import { redirect } from "next/navigation";
import { AccountsClient } from "./accounts-client";
import { BillingBanner } from "./billing-banner";
import { LogoutButton } from "@/app/ui/logout-button";
import { PricingSection } from "./pricing-section";
import { getBackendSession, getDashboardAccounts, getSubscriptionState } from "@/lib/api/server";

export default async function AccountsPage() {
  const session = await getBackendSession();

  if (!session.user) {
    redirect("/sign-in");
  }

  const [accounts, subscriptionState] = await Promise.all([
    getDashboardAccounts(),
    getSubscriptionState(),
  ]);

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((account) => account.isActive).length;
  const platformsConnected = new Set(accounts.map((account) => account.platform))
    .size;
  const needsAttention = accounts.filter((account) => !account.isActive).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <BillingBanner subscriptionState={subscriptionState} />
      <div className="rounded-lg border border-border-subtle bg-surface-2 p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              Accounts
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-ink">
              Connected platforms
            </h1>
            <p className="mt-1 text-sm text-muted">
              Add, audit, and disconnect social profiles in one tidy view.
            </p>
          </div>
          <LogoutButton />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total accounts",
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
              className="rounded-md border border-border-subtle bg-surface-1 p-4"
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
        </div>
      </div>

      <AccountsClient
        accounts={accounts}
        subscriptionState={subscriptionState}
      />

      <PricingSection />
    </div>
  );
}
