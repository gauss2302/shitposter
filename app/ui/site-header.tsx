import Image from "next/image";
import Link from "next/link";
import type { Session } from "@/lib/auth";
import { LogoutButton } from "@/app/ui/logout-button";

interface SiteHeaderProps {
  session: Session | null;
}

const authedLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Posts", href: "/dashboard/posts" },
  { label: "Accounts", href: "/dashboard/accounts" },
];

const marketingLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Demo", href: "/#demo" },
];

export function SiteHeader({ session }: SiteHeaderProps) {
  const links = session ? authedLinks : marketingLinks;
  const initials =
    session?.user.name?.slice(0, 1)?.toUpperCase() ||
    session?.user.email?.slice(0, 1)?.toUpperCase() ||
    "S";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800/60 dark:bg-zinc-950/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-zinc-100 shadow-md shadow-violet-500/20">
            <Image
              src="/hero_main_sm.png"
              alt="shitpost.art logo"
              fill
              className="object-cover"
              sizes="40px"
              priority
            />
          </div>
          <span className="text-lg tracking-tight text-zinc-900 dark:text-white">
            shitpost.art
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-500 md:flex dark:text-zinc-400">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-zinc-900 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200">
                  {initials}
                </div>
                <div className="hidden flex-col leading-tight sm:flex">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {session.user.name || session.user.email}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {session.user.email}
                  </span>
                </div>
              </div>
              <LogoutButton className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-200">
                Sign out
              </LogoutButton>
            </>
          ) : (
            <div className="flex items-center gap-3 text-sm font-semibold">
              <Link
                href="/sign-in"
                className="text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              >
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-zinc-900 px-4 py-2 text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
