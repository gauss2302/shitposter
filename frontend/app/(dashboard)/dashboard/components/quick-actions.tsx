import Link from "next/link";

export function QuickActions() {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/dashboard/posts"
        className="w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-on transition-colors hover:bg-primary-hover"
      >
        Create new post
      </Link>
      <Link
        href="/dashboard/accounts"
        className="w-full rounded-md border border-dashed border-border px-4 py-2 text-center text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-ink"
      >
        Connect account
      </Link>
    </div>
  );
}
