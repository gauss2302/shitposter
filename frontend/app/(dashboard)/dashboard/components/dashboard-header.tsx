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
  { key: "connectedAccounts", label: "Connected Accounts" },
  { key: "scheduledPosts", label: "Scheduled Posts" },
  { key: "publishedPosts", label: "Published This Week" },
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
    <header className="bg-linear-to-r from-[#5B63FF] via-[#566BFF] to-[#49C4FF] rounded-2xl md:rounded-3xl p-4 md:p-6 text-white shadow-[0_20px_60px_rgba(86,107,255,0.35)]">
      <div className="flex flex-col gap-3 md:gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-lg md:text-xl font-black shadow-[0_5px_15px_rgba(0,0,0,0.25)] overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name || "User avatar"}
                className="w-full h-full object-cover rounded-xl md:rounded-2xl"
              />
            ) : (
              initials
            )}
          </div>
          <div>
            <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider md:tracking-[0.2em] text-white/70">
              Authenticated
            </p>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight">
              Welcome back, {name?.split(" ")[0] || "friend"}.
            </h1>
            {email && <p className="text-xs md:text-sm text-white/70 truncate max-w-[200px] md:max-w-none">{email}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3">
          <Link
            href="/dashboard/posts"
            className="px-3 md:px-4 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-xl md:rounded-2xl bg-white text-[#4044C9] text-xs md:text-sm lg:text-base font-bold shadow-lg shadow-white/30 hover:-translate-y-0.5 transition-transform"
          >
            Create Post
          </Link>
          <Link
            href="/dashboard/accounts"
            className="px-3 md:px-4 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-xl md:rounded-2xl border border-white/30 text-white text-xs md:text-sm lg:text-base font-semibold hover:bg-white/10 transition-colors"
          >
            Manage Accounts
          </Link>
        </div>
      </div>

      <div className="mt-4 md:mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
        {STAT_LABELS.map((stat) => (
          <div
            key={stat.key}
            className="bg-white/10 rounded-xl md:rounded-2xl p-2 md:p-3 border border-white/20 backdrop-blur-sm"
          >
            <p className="text-[10px] md:text-xs font-semibold uppercase tracking-wider md:tracking-widest text-white/60">
              {stat.label}
            </p>
            <p className="text-2xl md:text-3xl font-black mt-0.5 md:mt-1">{stats[stat.key] ?? 0}</p>
          </div>
        ))}
      </div>
    </header>
  );
}
