import Image from "next/image";
import Link from "next/link";

const marketingLinks = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Demo", href: "/#demo" },
  { label: "Pricing", href: "/#pricing" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
          <span className="text-lg tracking-tight text-zinc-900">
            shitpost.art
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-500 md:flex">
          {marketingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-zinc-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link
            href="/sign-in"
            className="text-zinc-600 transition hover:text-zinc-900"
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-zinc-900 px-4 py-2 text-white transition hover:bg-zinc-800"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
