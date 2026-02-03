"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

interface LogoutButtonProps {
  className?: string;
  children?: ReactNode;
}

export function LogoutButton({ className, children }: LogoutButtonProps) {
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
      logger.error("Logout failed", error);
    } finally {
      setLoading(false);
    }
  };

  const defaultClasses =
    "px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition disabled:opacity-50";

  const label =
    children ??
    (loading ? "Logging out..." : "Log out");

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={className ?? defaultClasses}
    >
      {children ? (loading ? "..." : children) : label}
    </button>
  );
}
