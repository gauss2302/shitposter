"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SocialAccount } from "@/lib/db/schema";

const platformIcons: Record<string, string> = {
  twitter: "𝕏",
  instagram: "📸",
  tiktok: "🎵",
  linkedin: "💼",
  facebook: "📘",
  threads: "🧵",
};

const platformLimits: Record<string, number> = {
  twitter: 280,
  threads: 500,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
  facebook: 63206,
};

interface ComposeFormProps {
  accounts: SocialAccount[];
}

export function ComposeForm({ accounts }: ComposeFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const getMinCharLimit = () => {
    if (selectedAccounts.length === 0) return 280;
    const selectedPlatforms = accounts
      .filter((a) => selectedAccounts.includes(a.id))
      .map((a) => a.platform);
    return Math.min(...selectedPlatforms.map((p) => platformLimits[p] || 280));
  };

  const charLimit = getMinCharLimit();
  const isOverLimit = content.length > charLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!content.trim()) {
      setError("Please enter some content");
      return;
    }

    if (selectedAccounts.length === 0) {
      setError("Please select at least one account");
      return;
    }

    if (isOverLimit) {
      setError(`Content exceeds character limit (${charLimit})`);
      return;
    }

    setLoading(true);

    try {
      let scheduledFor: string | undefined;

      if (scheduleDate && scheduleTime) {
        scheduledFor = new Date(
          `${scheduleDate}T${scheduleTime}`
        ).toISOString();
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          socialAccountIds: selectedAccounts,
          scheduledFor,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create post");
      }

      router.push("/dashboard/posts?success=created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Account Selection */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Post to
        </label>
        <div className="flex flex-wrap gap-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => toggleAccount(account.id)}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${
                selectedAccounts.includes(account.id)
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              <span className="text-lg">{platformIcons[account.platform]}</span>
              @{account.platformUsername}
              {selectedAccounts.includes(account.id) && (
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={6}
          className="w-full p-4 bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 resize-none focus:outline-none text-lg"
        />
        <div className="px-4 pb-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <div className="flex gap-2">{/* Media buttons could go here */}</div>
          <span
            className={`text-sm font-medium ${
              isOverLimit ? "text-red-500" : "text-zinc-400"
            }`}
          >
            {content.length} / {charLimit}
          </span>
        </div>
      </div>

      {/* Scheduling */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Schedule (optional)
        </label>
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
          />
          <input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
          />
          {(scheduleDate || scheduleTime) && (
            <button
              type="button"
              onClick={() => {
                setScheduleDate("");
                setScheduleTime("");
              }}
              className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
        {!scheduleDate && !scheduleTime && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Leave empty to post immediately
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={
            loading ||
            !content.trim() ||
            selectedAccounts.length === 0 ||
            isOverLimit
          }
          className="px-6 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Creating..."
            : scheduleDate
            ? "Schedule Post"
            : "Post Now"}
        </button>
      </div>
    </form>
  );
}
