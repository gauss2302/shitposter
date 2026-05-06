"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/endpoints";
import type { SubscriptionState } from "@/lib/api/types";

const PLAN_LABELS: Record<string, string> = {
  basic: "Basic",
  business: "Business",
  enterprise: "Enterprise",
};

export function BillingBanner({
  subscriptionState,
}: {
  subscriptionState: SubscriptionState | null;
}) {
  const searchParams = useSearchParams();
  const [portalLoading, setPortalLoading] = useState(false);
  const error = searchParams.get("error");
  const success = searchParams.get("success");

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch(apiUrl(apiPaths.billing.portal), {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  }

  const showSubscriptionRequired =
    error === "subscription_required" || error === "limit_reached";
  const message =
    error === "subscription_required"
      ? "Subscribe to connect social accounts."
      : error === "limit_reached"
        ? "Account limit reached for this platform. Upgrade your plan to connect more."
        : null;

  return (
    <>
      {showSubscriptionRequired && message && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {message}{" "}
          <a
            href="#pricing"
            className="font-semibold underline hover:no-underline"
          >
            View plans
          </a>
        </div>
      )}
      {success === "subscribed" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Subscription active. You can connect accounts per your plan.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <span className="text-sm font-medium text-zinc-500">Plan:</span>
        {subscriptionState ? (
          <>
            <span className="rounded-full bg-violet-100 px-3 py-0.5 text-sm font-semibold text-violet-800">
              {PLAN_LABELS[subscriptionState.plan] ?? subscriptionState.plan}
            </span>
            <span className="text-sm text-zinc-500">
              {subscriptionState.limitPerPlatform === null
                ? "Unlimited accounts per platform"
                : `${subscriptionState.limitPerPlatform} account${subscriptionState.limitPerPlatform === 1 ? "" : "s"} per platform`}
            </span>
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="ml-auto text-sm font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-50"
            >
              {portalLoading ? "Opening…" : "Manage subscription"}
            </button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-zinc-200 px-3 py-0.5 text-sm font-medium text-zinc-600">
              No subscription
            </span>
            <a
              href="#pricing"
              className="ml-auto rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Subscribe to connect accounts
            </a>
          </>
        )}
      </div>
    </>
  );
}
