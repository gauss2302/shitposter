import Link from "next/link";

const marketingLinks = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#demo" },
  { label: "Pricing", href: "/#pricing" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-md bg-ink text-paper grid place-items-center transition-colors group-hover:bg-primary">
            <span className="font-semibold text-sm tracking-tight">S</span>
          </div>
          <span className="font-semibold text-ink tracking-[-0.01em]">
            shitpost.art
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          {marketingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/sign-in"
            className="px-3 py-2 text-muted transition-colors hover:text-ink"
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-ink px-4 py-2 font-semibold text-paper transition-colors hover:bg-primary"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
