"use client";

import type { ReactNode } from "react";
import Link from "next/link";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  isSignIn: boolean;
}

export function AuthLayout({
  children,
  title,
  subtitle,
  isSignIn,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-paper text-ink flex items-center justify-center p-4 lg:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-border-subtle bg-surface-2 shadow-lg lg:grid-cols-2">
        {/* Form column */}
        <div className="flex flex-col p-8 lg:p-12">
          <Link
            href="/"
            className="flex w-fit items-center gap-2.5 transition-colors hover:opacity-80"
          >
            <div className="grid h-8 w-8 place-items-center rounded-md bg-ink text-paper">
              <span className="font-semibold text-sm tracking-tight">S</span>
            </div>
            <span className="font-semibold tracking-[-0.01em]">
              shitpost.art
            </span>
          </Link>

          <div className="mx-auto mt-12 flex w-full max-w-sm flex-1 flex-col justify-center">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-[-0.02em] mb-2 text-balance">
                {title}
              </h1>
              <p className="text-muted text-pretty">{subtitle}</p>
            </div>

            {/* Mode toggle — pill-segmented control, not a fake button row */}
            <div
              role="tablist"
              aria-label="Sign in or sign up"
              className="mb-8 flex rounded-md border border-border-subtle bg-surface-1 p-1"
            >
              {isSignIn ? (
                <>
                  <div
                    role="tab"
                    aria-selected="true"
                    className="flex-1 rounded-sm bg-surface-2 py-2 text-center text-sm font-semibold text-ink shadow-sm"
                  >
                    Sign in
                  </div>
                  <Link
                    role="tab"
                    aria-selected="false"
                    href="/sign-up"
                    className="flex-1 rounded-sm py-2 text-center text-sm font-semibold text-muted transition-colors hover:text-ink"
                  >
                    Sign up
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    role="tab"
                    aria-selected="false"
                    href="/sign-in"
                    className="flex-1 rounded-sm py-2 text-center text-sm font-semibold text-muted transition-colors hover:text-ink"
                  >
                    Sign in
                  </Link>
                  <div
                    role="tab"
                    aria-selected="true"
                    className="flex-1 rounded-sm bg-surface-2 py-2 text-center text-sm font-semibold text-ink shadow-sm"
                  >
                    Sign up
                  </div>
                </>
              )}
            </div>

            {children}

            <p className="mt-8 text-center text-xs text-faint">
              By continuing you agree to the{" "}
              <Link href="/terms" className="underline hover:text-ink">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-ink">
                privacy policy
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Decorative column — tokenized, no bespoke 4-stop blue gradient */}
        <div className="relative hidden lg:flex bg-ink text-paper p-12 items-center justify-center overflow-hidden">
          <div
            aria-hidden
            className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/40 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-primary-tint/20 blur-3xl"
          />

          <div className="relative z-10 flex max-w-sm flex-col gap-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              shitpost.art
            </div>
            <p className="text-3xl font-semibold tracking-[-0.02em] leading-[1.15] text-balance">
              Post more.
              <br />
              Make it big.
            </p>
            <p className="text-base text-paper/70 leading-relaxed text-pretty">
              One queue, many platforms. Schedule a week ahead, ship while
              you sleep, and read the numbers without juggling tabs.
            </p>

            <ul className="mt-2 space-y-3 text-sm text-paper/80">
              {[
                "Multi-account per platform",
                "Per-platform retries and throttling",
                "Cross-platform analytics, one axis",
              ].map((line) => (
                <li key={line} className="flex items-center gap-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-pill bg-primary text-primary-on">
                    <svg
                      viewBox="0 0 16 16"
                      width="11"
                      height="11"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M3 8.5l3 3 7-7" />
                    </svg>
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
