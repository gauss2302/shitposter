import Link from "next/link";
import type { Session } from "@/lib/auth";

interface SiteFooterProps {
  session: Session | null;
}

export function SiteFooter({ session }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xl font-semibold text-zinc-900 dark:text-white">
              shitpost.art
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {session
                ? `Signed in as ${session.user.email}`
                : "You are browsing as a guest. Join to unlock the dashboard."}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <Link
              href="/dashboard"
              className="transition hover:text-zinc-900 dark:hover:text-white"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/posts"
              className="transition hover:text-zinc-900 dark:hover:text-white"
            >
              Posts
            </Link>
            <Link
              href="/dashboard/accounts"
              className="transition hover:text-zinc-900 dark:hover:text-white"
            >
              Accounts
            </Link>
            <Link
              href="/#demo"
              className="transition hover:text-zinc-900 dark:hover:text-white"
            >
              Demo
            </Link>
          </div>
        </div>
        <div className="mt-8 border-t border-zinc-100 pt-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          © {year} shitpost.art. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
