"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SocialAccount } from "@/lib/db/schema";

interface AccountsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: SocialAccount[];
}

const platforms = [
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: "𝕏",
    color: "bg-black",
    description: "Post tweets and threads",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
    description: "Share photos and reels",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎵",
    color: "bg-black",
    description: "Upload short videos",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    color: "bg-blue-700",
    description: "Professional updates",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "📘",
    color: "bg-blue-600",
    description: "Pages and groups",
  },
  {
    id: "threads",
    name: "Threads",
    icon: "🧵",
    color: "bg-black",
    description: "Text-based posts",
  },
];

export function AccountsSidebar({
  isOpen,
  onClose,
  accounts,
}: AccountsSidebarProps) {
  const router = useRouter();
  const [view, setView] = useState<"overview" | "connect">("overview");
  const [selectedAccount, setSelectedAccount] = useState<SocialAccount | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const handleConnect = async (platform: string) => {
    setLoading(true);
    window.location.href = `/api/social/connect/${platform}`;
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/social/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
        setSelectedAccount(null);
      } else {
        alert("Failed to disconnect account");
      }
    } catch (error) {
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const accountsByPlatform = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) acc[account.platform] = [];
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<string, typeof accounts>);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {view === "overview" ? "Connected Accounts" : "Connect Platform"}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {view === "overview"
                ? `${accounts.length} account${
                    accounts.length !== 1 ? "s" : ""
                  } connected`
                : "Choose a platform to connect"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setView("overview")}
            className={`flex-1 px-6 py-4 font-semibold transition relative ${
              view === "overview"
                ? "text-violet-600 dark:text-violet-400"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              🔗 My Accounts ({accounts.length})
            </span>
            {view === "overview" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400" />
            )}
          </button>
          <button
            onClick={() => setView("connect")}
            className={`flex-1 px-6 py-4 font-semibold transition relative ${
              view === "connect"
                ? "text-violet-600 dark:text-violet-400"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              ➕ Add New
            </span>
            {view === "connect" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === "overview" ? (
            <>
              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                    <span className="text-5xl">🔌</span>
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                    No accounts connected yet
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 mb-6 max-w-sm">
                    Connect your social media accounts to start scheduling posts
                    across all platforms
                  </p>
                  <button
                    onClick={() => setView("connect")}
                    className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition shadow-lg"
                  >
                    Connect Your First Account
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => {
                    const platform = platforms.find(
                      (p) => p.id === account.platform
                    );
                    return (
                      <div
                        key={account.id}
                        onClick={() => setSelectedAccount(account)}
                        className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer transition group"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-14 h-14 ${
                              platform?.color || "bg-zinc-200"
                            } rounded-xl flex items-center justify-center text-2xl flex-shrink-0`}
                          >
                            {platform?.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-zinc-900 dark:text-white truncate">
                                @{account.platformUsername}
                              </p>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  account.isActive
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                }`}
                              >
                                {account.isActive ? "Active" : "Disconnected"}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                              {platform?.name}
                            </p>
                            {account.followerCount !== null && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                {account.followerCount.toLocaleString()}{" "}
                                followers
                              </p>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition">
                            <svg
                              className="w-5 h-5 text-zinc-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {platforms.map((platform) => {
                const connectedCount =
                  accountsByPlatform[platform.id]?.length || 0;
                return (
                  <div
                    key={platform.id}
                    className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-violet-300 dark:hover:border-violet-600 transition"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-14 h-14 ${platform.color} rounded-xl flex items-center justify-center text-2xl text-white flex-shrink-0`}
                      >
                        {platform.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-zinc-900 dark:text-white">
                            {platform.name}
                          </h3>
                          {connectedCount > 0 && (
                            <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-xs font-semibold">
                              {connectedCount} connected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                          {platform.description}
                        </p>
                        <button
                          onClick={() => handleConnect(platform.id)}
                          disabled={loading}
                          className="w-full px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? "Connecting..." : "Connect Account"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 bg-violet-50 dark:bg-violet-900/20 border-t border-violet-100 dark:border-violet-800">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div className="flex-1">
              <h3 className="font-semibold text-violet-900 dark:text-violet-100 text-sm mb-1">
                Your data is secure
              </h3>
              <p className="text-xs text-violet-700 dark:text-violet-300">
                We only request minimum permissions. Tokens are encrypted.
                Disconnect anytime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Detail Modal */}
      {selectedAccount && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedAccount(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                Account Details
              </h3>
              <button
                onClick={() => setSelectedAccount(null)}
                className="w-8 h-8 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div
                  className={`w-16 h-16 ${
                    platforms.find((p) => p.id === selectedAccount.platform)
                      ?.color || "bg-zinc-200"
                  } rounded-xl flex items-center justify-center text-3xl`}
                >
                  {
                    platforms.find((p) => p.id === selectedAccount.platform)
                      ?.icon
                  }
                </div>
                <div>
                  <p className="font-bold text-lg text-zinc-900 dark:text-white">
                    @{selectedAccount.platformUsername}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">
                    {selectedAccount.platform}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedAccount.isActive
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {selectedAccount.isActive ? "Active" : "Disconnected"}
                  </span>
                </div>

                {selectedAccount.followerCount !== null && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Followers
                    </p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">
                      {selectedAccount.followerCount.toLocaleString()}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Connected Since
                  </p>
                  <p className="text-sm text-zinc-900 dark:text-white">
                    {new Date(selectedAccount.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>

                {selectedAccount.tokenExpiresAt && (
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Token Expires
                    </p>
                    <p className="text-sm text-zinc-900 dark:text-white">
                      {new Date(
                        selectedAccount.tokenExpiresAt
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <button
                  onClick={() => handleDisconnect(selectedAccount.id)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Disconnecting..." : "Disconnect Account"}
                </button>
                <button
                  onClick={() => setSelectedAccount(null)}
                  className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
