"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SocialAccount } from "@/lib/db/schema";

const platforms = [
  {
    id: "twitter",
    name: "X (Twitter)",
    icon: "𝕏",
    color: "bg-black",
    description: "Post tweets and threads",
    stats: "280 chars • Images & Videos",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📸",
    color: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
    description: "Share photos and reels",
    stats: "2,200 chars • 10 images max",
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "🎵",
    color: "bg-black",
    description: "Upload short videos",
    stats: "2,200 chars • Video only",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "💼",
    color: "bg-blue-700",
    description: "Professional updates",
    stats: "3,000 chars • 20 images max",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "📘",
    color: "bg-blue-600",
    description: "Pages and groups",
    stats: "63K chars • Rich media",
  },
  {
    id: "threads",
    name: "Threads",
    icon: "🧵",
    color: "bg-black",
    description: "Text-based posts",
    stats: "500 chars • Instagram linked",
  },
];

interface AccountsClientProps {
  accounts: SocialAccount[];
}

export function AccountsClient({ accounts }: AccountsClientProps) {
  const router = useRouter();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] =
    useState<SocialAccount | null>(null);

  const accountsByPlatform = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) acc[account.platform] = [];
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<string, SocialAccount[]>);

  const handleConnect = (platformId: string) => {
    window.location.href = `/api/social/connect/${platformId}`;
  };

  const handleDisconnectClick = (account: SocialAccount) => {
    setAccountToDisconnect(account);
    setShowDisconnectModal(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!accountToDisconnect) return;

    setDisconnectingId(accountToDisconnect.id);
    try {
      const res = await fetch(
        `/api/social/accounts/${accountToDisconnect.id}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        setShowDisconnectModal(false);
        setAccountToDisconnect(null);
        router.refresh();
      } else {
        alert("Failed to disconnect account");
      }
    } catch (error) {
      alert("An error occurred");
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Sidebar - Available Platforms */}
      <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-200">
          <h2 className="text-lg font-bold text-zinc-900 mb-1">Add Platform</h2>
          <p className="text-sm text-zinc-500">
            Connect your social media accounts
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {platforms.map((platform) => {
            const connectedCount = accountsByPlatform[platform.id]?.length || 0;
            const isSelected = selectedPlatform === platform.id;

            return (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-violet-500 bg-violet-50"
                    : "border-zinc-200 hover:border-violet-300 bg-white hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center text-white text-lg flex-shrink-0`}
                  >
                    {platform.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-900 text-sm">
                      {platform.name}
                    </h3>
                    {connectedCount > 0 && (
                      <span className="text-xs text-violet-600 font-medium">
                        {connectedCount} connected
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mb-1">
                  {platform.description}
                </p>
                <p className="text-xs text-zinc-400">{platform.stats}</p>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-zinc-200 bg-violet-50">
          <div className="flex items-start gap-2 text-xs text-violet-700">
            <span className="text-sm">🔒</span>
            <p>
              Your credentials are encrypted and stored securely. Disconnect
              anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col">
        {selectedPlatform ? (
          <>
            {/* Selected Platform Details */}
            <div className="p-6 border-b border-zinc-200">
              {(() => {
                const platform = platforms.find(
                  (p) => p.id === selectedPlatform
                );
                const connectedAccounts =
                  accountsByPlatform[selectedPlatform] || [];

                return (
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-16 h-16 ${platform?.color} rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg`}
                      >
                        {platform?.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-zinc-900 mb-1">
                          {platform?.name}
                        </h2>
                        <p className="text-sm text-zinc-500">
                          {connectedAccounts.length > 0
                            ? `${connectedAccounts.length} account${
                                connectedAccounts.length === 1 ? "" : "s"
                              } connected`
                            : "No accounts connected"}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConnect(selectedPlatform)}
                      className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl transition shadow-lg"
                    >
                      + Connect New Account
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Connected Accounts List */}
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const connectedAccounts =
                  accountsByPlatform[selectedPlatform] || [];

                if (connectedAccounts.length === 0) {
                  const platform = platforms.find(
                    (p) => p.id === selectedPlatform
                  );
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <div
                        className={`w-20 h-20 ${platform?.color} rounded-2xl flex items-center justify-center text-white text-4xl mb-6 shadow-lg`}
                      >
                        {platform?.icon}
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 mb-2">
                        No {platform?.name} Accounts Yet
                      </h3>
                      <p className="text-zinc-500 mb-6 max-w-md">
                        Connect your {platform?.name} account to start posting.
                        You can connect multiple accounts if needed.
                      </p>
                      <button
                        onClick={() => handleConnect(selectedPlatform)}
                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl transition shadow-lg"
                      >
                        Connect {platform?.name}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {connectedAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="p-6 border border-zinc-200 rounded-xl hover:border-violet-300 transition bg-zinc-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Avatar */}
                            <div className="w-14 h-14 rounded-xl bg-white border border-zinc-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {account.profileImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={account.profileImageUrl}
                                  alt={account.platformUsername}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-2xl">
                                  {
                                    platforms.find(
                                      (p) => p.id === account.platform
                                    )?.icon
                                  }
                                </span>
                              )}
                            </div>

                            {/* Account Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-bold text-zinc-900 text-lg">
                                  @{account.platformUsername}
                                </h3>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    account.isActive
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {account.isActive ? "Active" : "Disconnected"}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-zinc-500">
                                <span>
                                  Connected{" "}
                                  {account.createdAt.toLocaleDateString()}
                                </span>
                                {account.followerCount && (
                                  <span>
                                    {account.followerCount.toLocaleString()}{" "}
                                    followers
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDisconnectClick(account)}
                                disabled={disconnectingId === account.id}
                                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                              >
                                {disconnectingId === account.id
                                  ? "Disconnecting..."
                                  : "Disconnect"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </>
        ) : (
          /* No Platform Selected */
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 bg-violet-100 rounded-2xl flex items-center justify-center text-4xl mb-6">
              🔗
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">
              Select a Platform
            </h3>
            <p className="text-zinc-500 max-w-md">
              Choose a platform from the sidebar to view and manage your
              connected accounts, or to connect a new one.
            </p>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && accountToDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-900 mb-1">
                  Disconnect Account?
                </h3>
                <p className="text-sm text-zinc-600">
                  Are you sure you want to disconnect{" "}
                  <span className="font-semibold">
                    @{accountToDisconnect.platformUsername}
                  </span>
                  ?
                </p>
              </div>
            </div>

            <div className="bg-zinc-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-zinc-600">
                • Scheduled posts to this account will fail
                <br />• You will need to reconnect to post again
                <br />• This action cannot be undone
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDisconnectModal(false);
                  setAccountToDisconnect(null);
                }}
                className="flex-1 px-4 py-2 border border-zinc-300 text-zinc-700 font-medium rounded-lg hover:bg-zinc-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectConfirm}
                disabled={disconnectingId !== null}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition disabled:opacity-50"
              >
                {disconnectingId ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
