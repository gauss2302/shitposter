"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api/browser";
import { apiEndpoints } from "@/lib/api/endpoints";

const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "$9",
    period: "month",
    accounts: "1 account per platform",
  },
  {
    id: "business" as const,
    name: "Business",
    price: "$29",
    period: "month",
    accounts: "4 accounts per platform",
    highlight: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "$99",
    period: "month",
    accounts: "Unlimited accounts",
  },
];

export function PricingSection() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleSubscribe(plan: string) {
    setLoadingPlan(plan);
    try {
      const res = await fetch(apiUrl(apiEndpoints.billing.checkout), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section id="pricing" className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-zinc-900 mb-1">Plans</h2>
      <p className="text-sm text-zinc-500 mb-6">
        Subscribe to connect social accounts. Billed monthly.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-5 ${
              plan.highlight
                ? "border-violet-400 bg-violet-50/50"
                : "border-zinc-200"
            }`}
          >
            <p className="font-semibold text-zinc-900">{plan.name}</p>
            <p className="mt-2 text-2xl font-bold text-zinc-900">
              {plan.price}
              <span className="text-sm font-normal text-zinc-500">
                /{plan.period}
              </span>
            </p>
            <p className="mt-1 text-sm text-zinc-500">{plan.accounts}</p>
            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={!!loadingPlan}
              className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loadingPlan === plan.id ? "Opening…" : "Subscribe"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
