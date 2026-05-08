import Image from "next/image";
import Link from "next/link";
import { MarketingHeader } from "@/app/ui/marketing-header";
import { PlatformIcon, platformLabel } from "@/app/ui/platform-icon";

export default async function HomePage() {
  return (
    <div className="min-h-screen bg-paper text-ink overflow-x-hidden">
      <MarketingHeader />

      {/* =====================================================================
          Hero — single composition, brand-loud, one CTA group, one image.
          One purposeful halo behind the hero image (not three blurred blobs).
          ===================================================================== */}
      <section className="relative pt-32 pb-24 lg:pt-44 lg:pb-32 px-6 overflow-hidden">
        <div className="relative z-10 mx-auto grid max-w-7xl gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-pill bg-surface-2 border border-border-subtle shadow-sm mb-8">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-xs font-medium tracking-wide text-muted">
                Now booking your first post
              </span>
            </div>

            <h1 className="text-[clamp(3rem,6vw,5.5rem)] font-bold tracking-[-0.025em] leading-[1.02] mb-8 text-balance">
              Post more.{" "}
              <span className="bg-clip-text text-transparent bg-linear-to-r from-primary via-primary-hover to-primary animate-gradient">
                Make it big.
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-muted max-w-xl mb-10 leading-relaxed text-pretty">
              Schedule, analyze, and publish across every platform from one
              calm dashboard. Many accounts, one queue, zero spreadsheets.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-md bg-primary text-primary-on text-base font-semibold transition-colors hover:bg-primary-hover focus-visible:outline-none"
              >
                Start free
              </Link>
              <Link
                href="#demo"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-md border border-border bg-surface-2 text-ink text-base font-semibold transition-colors hover:bg-surface-1"
              >
                See how it works
              </Link>
            </div>

            <p className="mt-6 text-sm text-faint">
              No credit card. Cancel from the dashboard.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-12 -z-10 rounded-pill bg-primary-tint blur-3xl opacity-90" />
            <div className="relative rounded-xl border border-border-subtle bg-surface-2 p-3 shadow-lg">
              <Image
                src="/hero_main_sm.png"
                alt="Shitposter dashboard preview"
                width={800}
                height={600}
                priority
                className="rounded-lg object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Narrative — asymmetric, cardless. One job: tell what the product
          does in three named capabilities. No icon-in-circle grid.
          ===================================================================== */}
      <section
        id="features"
        className="py-24 px-6 border-t border-border-subtle bg-surface-2"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-[5fr_7fr] lg:gap-24">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary mb-5">
                What you get
              </p>
              <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-balance">
                Three things, done with care.
              </h2>
              <p className="mt-6 text-base text-muted leading-relaxed text-pretty">
                Most schedulers bolt on features. Shitposter does fewer
                things, properly: connect the accounts you actually post
                from, queue the posts you actually publish, and read the
                numbers that actually move.
              </p>
            </div>

            <ol className="divide-y divide-border-subtle">
              {[
                {
                  num: "01",
                  title: "Multi-account, real personas",
                  desc: "Connect multiple accounts per platform — handle agencies, brands, and alter-egos from one login. Plans from 1 to unlimited accounts per platform.",
                },
                {
                  num: "02",
                  title: "A queue that knows the rate limits",
                  desc: "Per-platform throttling, retries on transient errors, delivery tracking, timezone-aware slots. Posts go out while you sleep — without waking you when something breaks.",
                },
                {
                  num: "03",
                  title: "Numbers in one place",
                  desc: "Cross-platform analytics that don't lie about what worked. Engagement, reach, growth, all on the same axes. Skip the dashboard tabs.",
                },
              ].map((item) => (
                <li key={item.num} className="flex gap-6 py-8 first:pt-0">
                  <span className="text-sm font-semibold text-faint nums shrink-0 w-10 mt-1">
                    {item.num}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold tracking-[-0.01em] mb-2">
                      {item.title}
                    </h3>
                    <p className="text-base text-muted leading-relaxed text-pretty">
                      {item.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* =====================================================================
          How it works — diagram of the actual data flow. Cardless on the
          left, single visual on the right.
          ===================================================================== */}
      <section
        id="demo"
        className="py-24 px-6 border-t border-border-subtle"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary mb-5">
                How it works
              </p>
              <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-balance mb-10">
                Connect, plan, publish.
              </h2>
              <div className="space-y-7">
                {[
                  {
                    step: "01",
                    title: "Connect",
                    text: "Add Instagram, TikTok, LinkedIn, X, and more in seconds. OAuth handles the keys; we just hold the door.",
                  },
                  {
                    step: "02",
                    title: "Plan",
                    text: "Drag posts onto the universal calendar. Per-platform tweaks live next to the original. Queue conflicts surface before they ship.",
                  },
                  {
                    step: "03",
                    title: "Publish",
                    text: "The queue handles throttling, retries, and per-platform quirks. You see what shipped, what slipped, and why.",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-5">
                    <span className="text-sm font-semibold text-faint nums shrink-0 w-8 mt-1">
                      {item.step}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-1">
                        {item.title}
                      </h3>
                      <p className="text-base text-muted leading-relaxed text-pretty">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-xl border border-border-subtle bg-surface-2 p-10 shadow-sm">
                <div className="flex flex-col items-center gap-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-md bg-ink text-paper">
                    <svg
                      viewBox="0 0 24 24"
                      width="26"
                      height="26"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21a8 8 0 0 1 16 0" />
                    </svg>
                  </div>
                  <div className="h-12 w-px bg-border-subtle" />
                  <div className="rounded-md border border-border bg-paper px-5 py-3 text-center">
                    <span className="font-semibold text-ink text-sm">
                      shitpost.art core
                    </span>
                  </div>
                  <div className="h-12 w-px bg-border-subtle" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                    {(["instagram", "tiktok", "linkedin", "x"] as const).map(
                      (platform) => (
                        <div
                          key={platform}
                          className="flex flex-col items-center gap-2 rounded-md border border-border-subtle bg-surface-1 px-3 py-3 text-center text-ink"
                        >
                          <PlatformIcon platform={platform} size={20} />
                          <span className="text-xs text-muted">
                            {platformLabel(platform)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Pricing — compact, three columns is justified here (each is a
          distinct purchasable plan, not decorative).
          ===================================================================== */}
      <section
        id="pricing"
        className="py-24 px-6 border-t border-border-subtle bg-surface-2"
      >
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary mb-5">
              Pricing
            </p>
            <h2 className="text-4xl lg:text-5xl font-semibold tracking-[-0.02em] leading-[1.05] text-balance">
              Subscribe once. Use it daily.
            </h2>
            <p className="mt-5 text-base text-muted">
              Billed monthly. Plan limits are per platform.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                name: "Basic",
                price: "$9",
                accounts: "1 account per platform",
                plan: "basic",
              },
              {
                name: "Business",
                price: "$29",
                accounts: "4 accounts per platform",
                plan: "business",
                highlight: true,
              },
              {
                name: "Enterprise",
                price: "$99",
                accounts: "Unlimited accounts",
                plan: "enterprise",
              },
            ].map((tier) => (
              <div
                key={tier.plan}
                className={`rounded-lg p-6 transition-colors ${
                  tier.highlight
                    ? "border-2 border-ink bg-paper"
                    : "border border-border-subtle bg-paper"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-semibold text-ink">{tier.name}</p>
                  {tier.highlight && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
                      Most picked
                    </span>
                  )}
                </div>
                <p className="mt-4 text-4xl font-semibold text-ink nums tracking-[-0.02em]">
                  {tier.price}
                  <span className="ml-1 text-base font-normal text-muted">
                    /mo
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted">{tier.accounts}</p>
                <Link
                  href="/sign-up"
                  className={`mt-6 block w-full rounded-md py-3 text-center text-sm font-semibold transition-colors ${
                    tier.highlight
                      ? "bg-primary text-primary-on hover:bg-primary-hover"
                      : "bg-ink text-paper hover:opacity-90"
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          Footer — quiet, real links only.
          ===================================================================== */}
      <footer className="border-t border-border-subtle py-10 px-6">
        <div className="mx-auto max-w-7xl flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-ink text-paper grid place-items-center">
              <span className="font-semibold text-sm tracking-tight">S</span>
            </div>
            <span className="font-semibold text-ink">shitpost.art</span>
          </div>
          <div className="text-sm text-muted nums">
            © {new Date().getFullYear()} shitpost.art. All rights reserved.
          </div>
          <div className="flex gap-5 text-sm text-muted">
            <Link href="/sign-in" className="hover:text-ink transition-colors">
              Sign in
            </Link>
            <Link
              href="#pricing"
              className="hover:text-ink transition-colors"
            >
              Pricing
            </Link>
            <Link href="#demo" className="hover:text-ink transition-colors">
              How it works
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
