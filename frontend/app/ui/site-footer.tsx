import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-subtle bg-paper">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold tracking-[-0.01em] text-ink">
              shitpost.art
            </p>
            <p className="mt-1 text-sm text-muted">
              Plan, publish, and review your social accounts from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-muted">
            <Link
              href="/dashboard"
              className="transition-colors hover:text-ink"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/posts"
              className="transition-colors hover:text-ink"
            >
              Posts
            </Link>
            <Link
              href="/dashboard/accounts"
              className="transition-colors hover:text-ink"
            >
              Accounts
            </Link>
            <Link href="/#demo" className="transition-colors hover:text-ink">
              How it works
            </Link>
          </div>
        </div>
        <div className="mt-8 border-t border-border-subtle pt-6 text-sm text-muted nums">
          © {year} shitpost.art. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
