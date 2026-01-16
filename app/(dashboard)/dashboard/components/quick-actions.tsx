import Link from "next/link";

export function QuickActions() {
  return (
    <div className="flex flex-col gap-2 md:gap-3">
      <Link
        href="/dashboard/posts"
        className="w-full rounded-lg md:rounded-xl bg-linear-to-r from-[#5B63FF] to-[#49C4FF] px-3 md:px-4 py-2 md:py-2.5 text-center text-white text-xs md:text-sm font-semibold shadow-lg shadow-[#5B63FF]/30 hover:-translate-y-0.5 transition-transform"
      >
        Create new post
      </Link>
      <Link
        href="/dashboard/accounts"
        className="w-full rounded-lg md:rounded-xl border-2 border-dashed border-[#C5BAFF] px-3 md:px-4 py-2 md:py-2.5 text-center text-xs md:text-sm font-semibold text-[#566BFF] hover:border-[#566BFF] transition"
      >
        Connect account
      </Link>
    </div>
  );
}
