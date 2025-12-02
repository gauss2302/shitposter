import { auth } from "@/lib/auth";
import { db, socialAccount } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { DisconnectButton, ConnectButton, LogoutButton } from "./components";

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

export default async function AccountsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  const accounts = await db.query.socialAccount.findMany({
    where: eq(socialAccount.userId, session!.user.id),
    orderBy: desc(socialAccount.createdAt),
  });

  // Group accounts by platform
  const accountsByPlatform = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) acc[account.platform] = [];
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<string, typeof accounts>);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Connected Accounts
          </h1>
          <LogoutButton />
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Connect your social media accounts to start scheduling posts
        </p>
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              Your Accounts
            </h2>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {accounts.map((account) => {
              const platform = platforms.find((p) => p.id === account.platform);
              return (
                <div
                  key={account.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 ${
                        platform?.color || "bg-zinc-200"
                      } rounded-xl flex items-center justify-center text-xl`}
                    >
                      {platform?.icon}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">
                        @{account.platformUsername}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {platform?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          account.isActive ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {account.isActive ? "Active" : "Disconnected"}
                      </span>
                    </div>
                    <DisconnectButton accountId={account.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Platforms */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-white">
            Connect a Platform
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            You can connect multiple accounts from the same platform
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {platforms.map((platform) => {
            const connectedCount = accountsByPlatform[platform.id]?.length || 0;
            return (
              <div
                key={platform.id}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-12 h-12 ${platform.color} rounded-xl flex items-center justify-center text-xl text-white`}
                  >
                    {platform.icon}
                  </div>
                  {connectedCount > 0 && (
                    <span className="px-2 py-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                      {connectedCount} connected
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-zinc-900 dark:text-white">
                  {platform.name}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                  {platform.description}
                </p>
                <ConnectButton platform={platform.id} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-100 dark:border-violet-800">
        <h3 className="font-medium text-violet-900 dark:text-violet-100 mb-2">
          🔒 Your data is secure
        </h3>
        <p className="text-sm text-violet-700 dark:text-violet-300">
          We only request the minimum permissions needed to post on your behalf.
          Your access tokens are encrypted and stored securely. You can
          disconnect any account at any time.
        </p>
      </div>
    </div>
  );
}
