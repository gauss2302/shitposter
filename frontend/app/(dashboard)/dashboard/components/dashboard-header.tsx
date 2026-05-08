import Link from "next/link";

interface DashboardHeaderProps {
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
  stats: {
    connectedAccounts: number;
    scheduledPosts: number;
    publishedPosts: number;
  };
}

const STAT_LABELS = [
  { key: "connectedAccounts", label: "Connected accounts" },
  { key: "scheduledPosts", label: "Scheduled posts" },
  { key: "publishedPosts", label: "Published this week" },
] as const;

export function DashboardHeader({
  name,
  email,
  avatarUrl,
  stats,
}: DashboardHeaderProps) {
  const initials =
    name
      ?.split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SP";

  return (
    <header className="rounded-lg border border-border-subtle bg-surface-2 p-5 md:p-7 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="grid h-11 w-11 md:h-12 md:w-12 place-items-center overflow-hidden rounded-md bg-primary-tint text-primary text-lg font-semibold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name || "User avatar"}
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              Signed in
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.02em] text-ink">
              Welcome back, {name?.split(" ")[0] || "friend"}.
            </h1>
            {email && (
              <p className="mt-0.5 text-sm text-muted truncate max-w-[260px] md:max-w-none">
                {email}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/posts"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-on transition-colors hover:bg-primary-hover"
          >
            Create post
          </Link>
          <Link
            href="/dashboard/accounts"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-surface-1"
          >
            Manage accounts
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4">
        {STAT_LABELS.map((stat) => (
          <div
            key={stat.key}
            className="rounded-md border border-border-subtle bg-surface-1 p-3 md:p-4"
          >
            <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl md:text-3xl font-semibold text-ink nums tracking-[-0.02em]">
              {stats[stat.key] ?? 0}
            </p>
          </div>
        ))}
      </div>
    </header>
  );
}
