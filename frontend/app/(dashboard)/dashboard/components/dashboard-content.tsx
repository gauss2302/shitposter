"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarView } from "./calendar-view";
import { ViewToggle } from "./view-toggle";
import { EmptyState } from "./empty-state";
import { PlatformIcon } from "@/app/ui/platform-icon";
import type { Post, SocialAccount } from "@/lib/api/types";

interface DashboardContentProps {
  posts: Post[];
  accounts: SocialAccount[];
}

export function DashboardContent({ posts, accounts }: DashboardContentProps) {
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );

  return (
    <section className="space-y-4">
      {view === "calendar" ? (
        <CalendarView
          posts={posts}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountSelect={setSelectedAccountId}
        />
      ) : (
        <div className="grid gap-3 md:gap-4 lg:grid-cols-[2fr_1fr]">
          {/* Latest Activity */}
          <div className="rounded-lg border border-border-subtle bg-surface-2 p-4 md:p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-semibold tracking-[-0.01em] text-ink">
                  Latest activity
                </h2>
                <p className="text-xs md:text-sm text-muted">
                  Track drafts, scheduled drops, and published wins.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ViewToggle view={view} onViewChange={setView} />
                <Link
                  href="/dashboard/posts"
                  className="text-xs md:text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  View all
                </Link>
              </div>
            </div>
            {posts.length ? (
              <ul className="divide-y divide-border-subtle">
                {posts.slice(0, 15).map((recentPost) => (
                  <li
                    key={recentPost.id}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.08em] text-faint">
                        {recentPost.status}
                      </p>
                      <p className="mt-1 text-sm md:text-[15px] font-medium text-ink leading-snug line-clamp-2">
                        {recentPost.content}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-pill border border-border-subtle bg-surface-1 px-2.5 py-0.5 text-[10px] font-semibold text-muted nums">
                      {recentPost.scheduledFor
                        ? `Scheduled ${recentPost.scheduledFor.toLocaleDateString()}`
                        : `Posted ${recentPost.createdAt.toLocaleDateString()}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState accounts={accounts} />
            )}
          </div>

          {/* Connected accounts */}
          <div className="h-fit rounded-lg border border-border-subtle bg-surface-2 p-4 md:p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-semibold tracking-[-0.01em] text-ink">
                  Connected accounts
                </h2>
                <p className="text-xs md:text-sm text-muted">
                  Your active megaphones.
                </p>
              </div>
              <Link
                href="/dashboard/accounts"
                className="text-xs md:text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Manage
              </Link>
            </div>
            {accounts.length > 0 ? (
              <ul className="divide-y divide-border-subtle">
                {accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="grid h-9 w-9 place-items-center shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface-1 text-ink">
                      {account.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.profileImageUrl}
                          alt={`${account.platform} avatar`}
                          className="h-full w-full rounded-md object-cover"
                        />
                      ) : (
                        <PlatformIcon platform={account.platform} size={16} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        @{account.platformUsername}
                      </p>
                      <p className="text-xs capitalize text-muted">
                        {account.platform}
                      </p>
                    </div>
                    <div
                      className={`h-2 w-2 rounded-full ${
                        account.isActive ? "bg-success" : "bg-danger"
                      }`}
                      aria-label={account.isActive ? "Active" : "Offline"}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center">
                <p className="mb-4 text-sm text-muted">
                  No accounts connected yet.
                </p>
                <Link
                  href="/dashboard/accounts"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-on transition-colors hover:bg-primary-hover"
                >
                  Connect account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "calendar" && (
        <div className="flex justify-center">
          <button
            onClick={() => setView("list")}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-1"
          >
            Switch to list view
          </button>
        </div>
      )}
    </section>
  );
}
