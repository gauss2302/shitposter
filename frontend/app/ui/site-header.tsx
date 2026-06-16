"use client";

import Link from "next/link";
import { useSession } from "@/lib/api/auth";
import { LogoutButton } from "@/app/ui/logout-button";

const authedLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Posts", href: "/dashboard/posts" },
  { label: "Accounts", href: "/dashboard/accounts" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "AI", href: "/dashboard/ai" },
  { label: "Videos", href: "/dashboard/videos" },
  { label: "API", href: "/dashboard/developer" },
];

const marketingLinks = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#demo" },
];

export function SiteHeader() {
  const { data: session } = useSession();
  const user = session?.user;
  const links = user ? authedLinks : marketingLinks;
  const initials =
    user?.name?.slice(0, 1)?.toUpperCase() ||
    user?.email?.slice(0, 1)?.toUpperCase() ||
    "S";

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-ink text-paper transition-colors group-hover:bg-primary">
            <span className="font-semibold text-sm tracking-tight">S</span>
          </div>
          <span className="font-semibold tracking-[-0.01em] text-ink">
            shitpost.art
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 rounded-pill border border-border-subtle bg-surface-2 pl-1 pr-3 py-1 text-sm">
                <div className="grid h-7 w-7 place-items-center rounded-pill bg-primary-tint text-primary font-semibold">
                  {initials}
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-ink">
                    {user.name || user.email}
                  </span>
                  <span className="text-[10px] text-muted">{user.email}</span>
                </div>
              </div>
              <LogoutButton className="rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-1">
                Sign out
              </LogoutButton>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-3 py-2 text-sm text-muted transition-colors hover:text-ink"
              >
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-primary"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
