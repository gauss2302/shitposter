import Link from "next/link";
import type { SocialAccount } from "@/lib/api/types";

interface EmptyStateProps {
  accounts: SocialAccount[];
}

export function EmptyState({ accounts }: EmptyStateProps) {
  const noAccounts = accounts.length === 0;

  const headline = noAccounts ? "No accounts connected" : "No posts yet";
  const body = noAccounts
    ? "Connect a social media account first to start posting."
    : "Draft something spicy, schedule it, and we'll show the play-by-play here.";
  const cta = noAccounts ? "Connect account" : "Start writing";
  const href = noAccounts ? "/dashboard/accounts" : "/dashboard/posts";

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-1 p-10 text-center">
      <div
        aria-hidden
        className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-md bg-surface-2 text-muted"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <p className="mb-1 text-base font-semibold text-ink">{headline}</p>
      <p className="mx-auto mb-6 max-w-sm text-sm text-muted">{body}</p>
      <Link
        href={href}
        className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-on transition-colors hover:bg-primary-hover"
      >
        {cta}
      </Link>
    </div>
  );
}
