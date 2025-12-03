"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SocialAccount, Post } from "@/lib/db/schema";

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: SocialAccount[];
  posts: Post[];
}

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

function Calendar({
  posts,
  onSelectDate,
  selectedDate,
}: {
  posts: Post[];
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  const previousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  const getPostsForDate = (day: number) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    return posts.filter((post) => {
      if (!post.scheduledFor) return false;
      const postDate = new Date(post.scheduledFor);
      return (
        postDate.getDate() === day &&
        postDate.getMonth() === currentMonth.getMonth() &&
        postDate.getFullYear() === currentMonth.getFullYear()
      );
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const calendarDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayPosts = getPostsForDate(day);
    const today = isToday(day);
    const selected = isSelected(day);

    calendarDays.push(
      <div
        key={day}
        onClick={() =>
          onSelectDate(
            new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
          )
        }
        className={`aspect-square p-2 border border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20 transition relative ${
          today ? "bg-violet-100 dark:bg-violet-900/30 border-violet-300" : ""
        } ${selected ? "ring-2 ring-violet-500" : ""}`}
      >
        <div
          className={`text-sm font-medium ${
            today
              ? "text-violet-700 dark:text-violet-300"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {day}
        </div>
        {dayPosts.length > 0 && (
          <div className="mt-1 space-y-1">
            {dayPosts.slice(0, 2).map((post) => (
              <div
                key={post.id}
                className="text-xs bg-violet-600 text-white rounded px-1 py-0.5 truncate"
                title={post.content}
              >
                📝
              </div>
            ))}
            {dayPosts.length > 2 && (
              <div className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                +{dayPosts.length - 2} more
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={previousMonth}
          className="w-10 h-10 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
        >
          ←
        </button>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={nextMonth}
          className="w-10 h-10 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
        {daysOfWeek.map((day) => (
          <div
            key={day}
            className="bg-zinc-50 dark:bg-zinc-800 p-2 text-center text-sm font-semibold text-zinc-600 dark:text-zinc-400"
          >
            {day}
          </div>
        ))}
        {calendarDays.map((day, i) => (
          <div key={i} className="bg-white dark:bg-zinc-900">
            {day}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PostModal({
  isOpen,
  onClose,
  accounts,
  posts,
}: PostModalProps) {
  const router = useRouter();
  const [view, setView] = useState<"compose" | "calendar">("compose");
  const [content, setContent] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(
    null
  );
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

      // Reset form
      setContent("");
      setSelectedAccounts([]);
      setScheduleDate("");
      setScheduleTime("");
      setSelectedCalendarDate(null);

      // Switch to calendar view
      setView("calendar");

      // Refresh the page data
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedCalendarDate(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    setScheduleDate(`${year}-${month}-${day}`);
    setView("compose");
  };

  const getPostsForSelectedDate = () => {
    if (!selectedCalendarDate) return [];
    return posts.filter((post) => {
      if (!post.scheduledFor) return false;
      const postDate = new Date(post.scheduledFor);
      return (
        postDate.getDate() === selectedCalendarDate.getDate() &&
        postDate.getMonth() === selectedCalendarDate.getMonth() &&
        postDate.getFullYear() === selectedCalendarDate.getFullYear()
      );
    });
  };

  if (!isOpen) return null;

  const activeAccounts = accounts.filter((a) => a.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {view === "compose" ? "✏️ Create Post" : "📅 Content Calendar"}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setView("compose")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  view === "compose"
                    ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Compose
              </button>
              <button
                onClick={() => setView("calendar")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  view === "calendar"
                    ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                Calendar
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === "compose" ? (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Account Selection */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Post to
                </label>
                <div className="flex flex-wrap gap-2">
                  {activeAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleAccount(account.id)}
                      className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition border ${
                        selectedAccounts.includes(account.id)
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300"
                          : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
                      }`}
                    >
                      <span className="text-lg">
                        {platformIcons[account.platform]}
                      </span>
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
                  rows={8}
                  className="w-full p-4 bg-transparent text-zinc-900 dark:text-white placeholder-zinc-400 resize-none focus:outline-none text-lg"
                />
                <div className="px-4 pb-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <div className="flex gap-2">
                    {/* Placeholder for media buttons */}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isOverLimit
                        ? "text-red-500"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {content.length} / {charLimit}
                  </span>
                </div>
              </div>

              {/* Scheduling */}
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Schedule (optional)
                </label>
                <div className="flex flex-wrap gap-3">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                  />
                  {(scheduleDate || scheduleTime) && (
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleDate("");
                        setScheduleTime("");
                        setSelectedCalendarDate(null);
                      }}
                      className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {!scheduleDate && !scheduleTime && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                    Leave empty to post immediately, or click a date in the
                    calendar view
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
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    loading ||
                    !content.trim() ||
                    selectedAccounts.length === 0 ||
                    isOverLimit
                  }
                  className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {loading
                    ? "Creating..."
                    : scheduleDate
                    ? "📅 Schedule Post"
                    : "🚀 Post Now"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Calendar
                  posts={posts}
                  onSelectDate={handleDateSelect}
                  selectedDate={selectedCalendarDate}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  {selectedCalendarDate
                    ? `Posts on ${selectedCalendarDate.toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        }
                      )}`
                    : "Select a date"}
                </h3>
                {selectedCalendarDate ? (
                  <div className="space-y-3">
                    {getPostsForSelectedDate().length > 0 ? (
                      getPostsForSelectedDate().map((post) => (
                        <div
                          key={post.id}
                          className="p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer transition"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {post.scheduledFor &&
                                new Date(post.scheduledFor).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  }
                                )}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-900 dark:text-white line-clamp-2">
                            {post.content}
                          </p>
                          <div className="mt-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                post.status === "published"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : post.status === "scheduled"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              }`}
                            >
                              {post.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800 rounded-lg border-2 border-dashed border-zinc-200 dark:border-zinc-700">
                        <p className="text-zinc-500 dark:text-zinc-400 mb-3">
                          No posts scheduled
                        </p>
                        <button
                          onClick={() => {
                            handleDateSelect(selectedCalendarDate);
                          }}
                          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition"
                        >
                          Create Post
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                    Click on a date in the calendar to view or create posts
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
