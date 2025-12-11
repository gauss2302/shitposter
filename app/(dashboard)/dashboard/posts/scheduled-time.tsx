"use client";

interface ScheduledTimeProps {
  date: Date;
  status: string;
}

export function ScheduledTime({ date, status }: ScheduledTimeProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatted = date.toLocaleString(undefined, {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <span className="text-xs text-zinc-500 dark:text-zinc-400">
      {status === "scheduled"
        ? `Scheduled for ${formatted}`
        : `Was scheduled for ${formatted}`}
    </span>
  );
}

