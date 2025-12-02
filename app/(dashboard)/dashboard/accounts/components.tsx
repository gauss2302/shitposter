"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function ConnectButton({ platform }: { platform: string }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    // Redirect to OAuth flow
    window.location.href = `/api/social/connect/${platform}`;
  };

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="w-full py-2 px-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50"
    >
      {loading ? "Connecting..." : "Connect"}
    </button>
  );
}

export function DisconnectButton({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/social/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert("Failed to disconnect account");
      }
    } catch (error) {
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDisconnect}
      disabled={loading}
      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
    >
      {loading ? "..." : "Disconnect"}
    </button>
  );
}

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/sign-in");
            router.refresh();
          },
        },
      });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition disabled:opacity-50"
    >
      {loading ? "Logging out..." : "Log out"}
    </button>
  );
}
