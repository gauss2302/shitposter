"use client";

interface ViewToggleProps {
  view: "list" | "calendar";
  onViewChange: (view: "list" | "calendar") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  const baseBtn =
    "px-3 py-1 rounded-sm text-xs md:text-sm font-medium transition-colors";
  const selected = "bg-surface-2 text-ink shadow-sm";
  const idle = "text-muted hover:text-ink";

  return (
    <div
      role="tablist"
      aria-label="Activity view"
      className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-1 p-1"
    >
      <button
        role="tab"
        aria-selected={view === "list"}
        onClick={() => onViewChange("list")}
        className={`${baseBtn} ${view === "list" ? selected : idle}`}
      >
        List
      </button>
      <button
        role="tab"
        aria-selected={view === "calendar"}
        onClick={() => onViewChange("calendar")}
        className={`${baseBtn} ${view === "calendar" ? selected : idle}`}
      >
        Calendar
      </button>
    </div>
  );
}
