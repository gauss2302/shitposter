"use client";

import { useState } from "react";
import { ScheduledTime } from "./scheduled-time";
import { PostsViewToggle } from "./posts-view-toggle";
import { PostsTableView } from "./posts-table-view";
import type { Post, PostTarget, SocialAccount } from "@/lib/db/schema";
import Link from "next/link";

const platformIcons: Record<string, string> = {
  twitter: "𝕏",
  instagram: "📸",
  tiktok: "🎵",
  linkedin: "💼",
  facebook: "📘",
  threads: "🧵",
};

const statusColors: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  publishing:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  published:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

interface PostsViewClientProps {
  posts: Array<
    Post & {
      targets: Array<
        PostTarget & {
          account: SocialAccount | null;
        }
      >;
    }
  >;
}

function getPlatformUrl(
  platform: string,
  username: string,
  postId: string
): string {
  switch (platform) {
    case "twitter":
      return `https://twitter.com/${username}/status/${postId}`;
    case "instagram":
      return `https://www.instagram.com/p/${postId}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${username}/video/${postId}`;
    case "linkedin":
      return `https://www.linkedin.com/feed/update/${postId}`;
    default:
      return "#";
  }
}

export function PostsViewClient({ posts }: PostsViewClientProps) {
  const [view, setView] = useState<"cards" | "table">("cards");

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base md:text-lg font-bold text-zinc-900 dark:text-white">
          All Posts
        </h2>
        <PostsViewToggle view={view} onViewChange={setView} />
      </div>

      {view === "table" ? (
        <PostsTableView posts={posts} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
          {posts.map((postItem) => (
            <div
              key={postItem.id}
              className="bg-white dark:bg-zinc-900 rounded-lg md:rounded-xl p-2.5 md:p-3 border border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 transition flex flex-col"
            >
              <div className="flex items-start justify-between gap-2 md:gap-3 mb-2 md:mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 flex-wrap">
                    <span
                      className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold rounded-full ${
                        statusColors[postItem.status] || statusColors.draft
                      }`}
                    >
                      {postItem.status}
                    </span>
                    {postItem.scheduledFor && (
                      <ScheduledTime
                        date={postItem.scheduledFor}
                        status={postItem.status}
                      />
                    )}
                  </div>
                  <p className="text-xs md:text-sm text-zinc-900 dark:text-white leading-snug line-clamp-3">
                    {postItem.content}
                  </p>
                </div>
              </div>

              {/* Targets */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 md:pt-3 mt-auto">
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 md:mb-2">
                  Publishing To
                </p>
                <div className="flex flex-wrap gap-1 md:gap-1.5">
                  {postItem.targets.slice(0, 3).map((target) => (
                    <div
                      key={target.id}
                      className={`flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded border text-[10px] md:text-xs ${
                        target.status === "published"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                          : target.status === "failed"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          : target.status === "publishing"
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                          : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      <span className="text-xs md:text-sm">
                        {target.account
                          ? platformIcons[target.account.platform] || "🌐"
                          : "❓"}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[60px] md:max-w-[80px]">
                        @{target.account?.platformUsername?.substring(0, 8) || "Unknown"}
                      </span>
                      {target.platformPostId && (
                        <a
                          href={getPlatformUrl(
                            target.account?.platform || "",
                            target.account?.platformUsername || "",
                            target.platformPostId
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex-shrink-0"
                          title={`View on ${
                            target.account?.platform || "platform"
                          }`}
                        >
                          <svg
                            className="w-2.5 h-2.5 md:w-3 md:h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
                  {postItem.targets.length > 3 && (
                    <div className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5">
                      +{postItem.targets.length - 3} more
                    </div>
                  )}
                </div>
                {postItem.targets.some((t) => t.errorMessage) && (
                  <div className="mt-1.5 md:mt-2 p-1.5 md:p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-[10px] md:text-xs font-semibold text-red-700 dark:text-red-300 mb-0.5 md:mb-1">
                      Errors:
                    </p>
                    {postItem.targets
                      .filter((t) => t.errorMessage)
                      .slice(0, 1)
                      .map((t) => (
                        <p
                          key={t.id}
                          className="text-[10px] md:text-xs text-red-600 dark:text-red-400 line-clamp-1"
                        >
                          • {t.account?.platformUsername}: {t.errorMessage}
                        </p>
                      ))}
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1.5 md:pt-2 mt-1.5 md:mt-2 flex items-center justify-between text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400">
                <span className="truncate">
                  {new Date(postItem.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
