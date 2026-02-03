"use client";

import Link from "next/link";
import type { Post, PostTarget, SocialAccount } from "@/lib/db/schema";

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

interface PostsTableViewProps {
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

export function PostsTableView({ posts }: PostsTableViewProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <table className="w-full text-left">
        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
          <tr>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Content
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Platforms
            </th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {posts.map((post) => (
            <tr
              key={post.id}
              className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <td className="px-4 py-2.5">
                <p className="text-sm text-zinc-900 dark:text-white line-clamp-2 max-w-xs">
                  {post.content}
                </p>
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    statusColors[post.status] || statusColors.draft
                  }`}
                >
                  {post.status}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {post.targets.map((target) => (
                    <div
                      key={target.id}
                      className="flex items-center gap-1"
                      title={`${target.account?.platformUsername || "Unknown"}: ${target.status}`}
                    >
                      <span className="text-sm">
                        {target.account
                          ? platformIcons[target.account.platform] || "🌐"
                          : "❓"}
                      </span>
                      {target.platformPostId && target.account && (
                        <a
                          href={getPlatformUrl(
                            target.account.platform,
                            target.account.platformUsername,
                            target.platformPostId
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                        >
                          <svg
                            className="w-3 h-3"
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
                </div>
              </td>
              <td className="px-4 py-2.5">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {post.scheduledFor
                    ? post.scheduledFor.toLocaleDateString()
                    : post.createdAt.toLocaleDateString()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
