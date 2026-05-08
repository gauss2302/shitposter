"use client";

interface ViewToggleProps {
  view: "list" | "calendar";
  onViewChange: (view: "list" | "calendar") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#E8F0FF] bg-white p-1">
      <button
        onClick={() => onViewChange("list")}
        className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${
          view === "list"
            ? "bg-[#566BFF] text-white"
            : "text-zinc-600 hover:text-zinc-900"
        }`}
      >
        List
      </button>
      <button
        onClick={() => onViewChange("calendar")}
        className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${
          view === "calendar"
            ? "bg-[#566BFF] text-white"
            : "text-zinc-600 hover:text-zinc-900"
        }`}
      >
        Calendar
      </button>
    </div>
  );
}
