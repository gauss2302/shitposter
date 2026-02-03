"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarView } from "./calendar-view";
import { ViewToggle } from "./view-toggle";
import { EmptyState } from "./empty-state";
import type { Post, SocialAccount } from "@/lib/db/schema";

interface DashboardContentProps {
  posts: Post[];
  accounts: SocialAccount[];
}

function platformIcon(platform: string) {
  if (platform === "twitter") return "𝕏";
  if (platform === "instagram") return "📸";
  if (platform === "tiktok") return "🎵";
  if (platform === "linkedin") return "💼";
  return "🌐";
}

export function DashboardContent({ posts, accounts }: DashboardContentProps) {
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  return (
    <section className="space-y-4">
      {/* Calendar View - Full Width when in Calendar mode */}
      {view === "calendar" ? (
        <CalendarView
          posts={posts}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountSelect={setSelectedAccountId}
        />
      ) : (
        <div className="grid gap-3 md:gap-4 lg:grid-cols-[2fr,1fr]">
          {/* Latest Activity List */}
          <div className="rounded-2xl md:rounded-3xl border border-[#E8F0FF] bg-white p-3 md:p-4 lg:p-6 shadow-xl shadow-[#C4D9FF]/15">
            <div className="flex items-center justify-between gap-2 md:gap-4 mb-3 md:mb-4">
              <div>
                <h2 className="text-base md:text-lg font-bold text-zinc-900">
                  Latest Activity
                </h2>
                <p className="text-xs md:text-sm text-zinc-500">
                  Track drafts, scheduled drops, and published wins.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ViewToggle view={view} onViewChange={setView} />
                <Link
                  href="/dashboard/posts"
                  className="text-xs md:text-sm font-semibold text-[#566BFF] hover:text-[#3947ff]"
                >
                  View all
                </Link>
              </div>
            </div>
            {posts.length ? (
              <div className="space-y-2 md:space-y-2.5">
                {posts.slice(0, 15).map((recentPost) => (
                  <div
                    key={recentPost.id}
                    className="rounded-lg md:rounded-xl border border-[#EEF2FF] bg-[#F9FAFF] p-2.5 md:p-3 hover:border-[#d4dcff] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 md:gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          {recentPost.status}
                        </p>
                        <p className="mt-0.5 md:mt-1 font-bold text-zinc-900 text-xs md:text-sm leading-snug line-clamp-2">
                          {recentPost.content}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 md:px-2.5 py-0.5 md:py-1 text-[9px] md:text-[10px] font-bold text-[#566BFF] shadow-sm border border-[#EEF2FF]">
                        {recentPost.scheduledFor
                          ? `Scheduled ${recentPost.scheduledFor.toLocaleDateString()}`
                          : `Posted ${recentPost.createdAt.toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState accounts={accounts} />
            )}
          </div>

          {/* Connected Accounts List */}
          <div className="rounded-2xl md:rounded-3xl border border-[#E8F0FF] bg-white p-3 md:p-4 lg:p-6 shadow-xl shadow-[#C4D9FF]/15 h-fit">
            <div className="flex items-center justify-between gap-2 md:gap-4 mb-3 md:mb-4">
              <div>
                <h2 className="text-base md:text-lg font-bold text-zinc-900">
                  Connected Accounts
                </h2>
                <p className="text-xs md:text-sm text-zinc-500">Your active megaphones.</p>
              </div>
              <Link
                href="/dashboard/accounts"
                className="text-xs md:text-sm font-semibold text-[#566BFF] hover:text-[#3947ff]"
              >
                Manage
              </Link>
            </div>
            {accounts.length > 0 ? (
              <div className="space-y-2 md:space-y-2.5">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-2 md:gap-3 rounded-lg md:rounded-xl border border-[#EEF2FF] bg-[#FBFBFF] p-2 md:p-2.5 shadow-sm"
                  >
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white border border-[#E8F0FF] flex items-center justify-center text-base md:text-lg shrink-0">
                      {account.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={account.profileImageUrl}
                          alt={`${account.platform} avatar`}
                          className="w-full h-full rounded-lg object-cover"
                        />
                      ) : (
                        platformIcon(account.platform)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 text-xs md:text-sm truncate">
                        @{account.platformUsername}
                      </p>
                      <p className="text-[10px] md:text-xs text-zinc-500 capitalize">
                        {account.platform}
                      </p>
                    </div>
                    <div
                      className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${
                        account.isActive ? "bg-[#0FAD5B]" : "bg-[#B91C1C]"
                      }`}
                      title={account.isActive ? "Active" : "Offline"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 md:py-6">
                <p className="text-xs md:text-sm text-zinc-500 mb-3 md:mb-4">
                  No accounts connected yet.
                </p>
                <Link
                  href="/dashboard/accounts"
                  className="inline-flex px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl bg-[#566BFF] text-white text-xs md:text-sm font-semibold shadow-lg shadow-[#566BFF]/30"
                >
                  Connect Account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Toggle for Calendar mode */}
      {view === "calendar" && (
        <div className="flex justify-center">
          <button
            onClick={() => setView("list")}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
          >
            Switch to List View
          </button>
        </div>
      )}
    </section>
  );
}
