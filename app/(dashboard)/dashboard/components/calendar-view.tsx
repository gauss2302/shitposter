"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Post, SocialAccount } from "@/lib/db/schema";

interface CalendarViewProps {
  posts: Post[];
  accounts: SocialAccount[];
  selectedAccountId: string | null;
  onAccountSelect: (accountId: string | null) => void;
}

type ViewType = "week" | "month" | "day";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_IN_WEEK = 7;

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  draft: { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-700" },
  scheduled: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  publishing: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  published: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  failed: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
};

function platformIcon(platform: string) {
  if (platform === "twitter") return "𝕏";
  if (platform === "instagram") return "📸";
  if (platform === "tiktok") return "🎵";
  if (platform === "linkedin") return "💼";
  if (platform === "threads") return "🧵";
  if (platform === "bluesky") return "🦋";
  return "🌐";
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function getWeekDays(date: Date): Date[] {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);
  
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function CalendarView({ posts, accounts, selectedAccountId, onAccountSelect }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("week");

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  
  const filteredPosts = useMemo(() => {
    if (!selectedAccountId) return posts;
    // Filter by account (you'd need to add postTarget relation for accurate filtering)
    return posts;
  }, [posts, selectedAccountId]);

  const postsByDateAndHour = useMemo(() => {
    const map = new Map<string, Post[]>();
    
    filteredPosts.forEach((post) => {
      const date = post.scheduledFor ? new Date(post.scheduledFor) : new Date(post.createdAt);
      const key = `${date.toDateString()}-${date.getHours()}`;
      
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(post);
    });
    
    return map;
  }, [filteredPosts]);

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthYear = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const today = new Date();

  const connectedPlatforms = ["twitter", "instagram", "threads", "bluesky", "linkedin", "tiktok"];
  const availablePlatforms = connectedPlatforms.filter(
    (p) => !accounts.some((a) => a.platform === p)
  );

  return (
    <div className="flex h-[700px] lg:h-[800px] rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-lg">
      {/* Left Sidebar - Channels */}
      <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50/50">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Channels
          </h3>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto">
          {/* All Channels */}
          <button
            onClick={() => onAccountSelect(null)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
              !selectedAccountId
                ? "bg-blue-50 border-l-2 border-blue-500"
                : "hover:bg-slate-100 border-l-2 border-transparent"
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">All Channels</p>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
              {posts.length}
            </span>
          </button>

          {/* Divider */}
          <div className="h-px bg-slate-200 my-2" />

          {/* Connected Accounts */}
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => onAccountSelect(account.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                selectedAccountId === account.id
                  ? "bg-blue-50 border-l-2 border-blue-500"
                  : "hover:bg-slate-100 border-l-2 border-transparent"
              }`}
            >
              <div className="relative">
                {account.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={account.profileImageUrl}
                    alt={account.platformUsername}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">
                    {platformIcon(account.platform)}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center text-[10px]">
                  {platformIcon(account.platform)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {account.platformUsername}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                0
              </span>
            </button>
          ))}

          {/* Divider */}
          {availablePlatforms.length > 0 && <div className="h-px bg-slate-200 my-2" />}

          {/* Available to Connect */}
          {availablePlatforms.slice(0, 4).map((platform) => (
            <Link
              key={platform}
              href={`/api/social/connect/${platform}`}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm text-slate-400 group-hover:text-slate-600">
                {platformIcon(platform)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-500 group-hover:text-slate-700 capitalize">
                  Connect {platform === "twitter" ? "X" : platform}
                </p>
              </div>
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </Link>
          ))}

          {/* Show More */}
          {availablePlatforms.length > 4 && (
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4 text-slate-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-sm text-slate-500">Show more channels</span>
            </button>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs mb-3">
            <span className="text-slate-600">{accounts.length}/3 channels connected</span>
            <button className="text-slate-400 hover:text-slate-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full ${
                  i < accounts.length ? "bg-blue-500" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <Link
            href="/dashboard/accounts"
            className="flex items-center justify-center gap-2 w-full py-2 mt-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Upgrade for More
          </Link>
        </div>

        {/* Bottom Links */}
        <div className="p-4 border-t border-slate-200 space-y-1">
          <button className="flex items-center gap-2 w-full px-2 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Manage Tags
          </button>
          <Link
            href="/dashboard/accounts"
            className="flex items-center gap-2 w-full px-2 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Manage Channels
          </Link>
        </div>
      </div>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            {selectedAccount ? (
              <div className="flex items-center gap-3">
                {selectedAccount.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedAccount.profileImageUrl}
                    alt={selectedAccount.platformUsername}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg">
                    {platformIcon(selectedAccount.platform)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedAccount.platformUsername}
                    </h2>
                    <button className="text-slate-400 hover:text-slate-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    ⭐ {filteredPosts.length}/5 posts sent this week
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold text-slate-900">All Channels</h2>
                <p className="text-xs text-slate-500">{filteredPosts.length} total posts</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-md transition-colors">
                ☰ List
              </button>
              <button className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-white rounded-md shadow-sm">
                📅 Calendar
              </button>
            </div>

            {/* New Post Button */}
            <Link
              href="/dashboard/posts/new"
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Post
            </Link>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateWeek("prev")}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => navigateWeek("next")}
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold text-slate-900">{monthYear}</h3>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors"
            >
              Today
            </button>
            <div className="relative">
              <select
                value={viewType}
                onChange={(e) => setViewType(e.target.value as ViewType)}
                className="appearance-none px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors cursor-pointer"
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="day">Day</option>
              </select>
              <svg className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
              All Posts
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Tags
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:border-slate-400 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Timezone
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          {viewType === "week" && (
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
                <div className="w-16 flex-shrink-0" />
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  const dayName = day.toLocaleDateString("en-US", { weekday: "long" });
                  const dayNum = day.getDate();
                  
                  return (
                    <div
                      key={i}
                      className={`flex-1 py-3 px-2 text-center border-l border-slate-200 ${
                        isToday ? "bg-blue-50" : ""
                      }`}
                    >
                      <p className={`text-sm ${isToday ? "text-blue-600 font-semibold" : "text-slate-500"}`}>
                        {dayName}
                      </p>
                      <p className={`text-lg font-semibold ${isToday ? "text-blue-600" : "text-slate-900"}`}>
                        {dayNum}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Time Grid */}
              <div className="relative">
                {HOURS.filter((_, i) => i % 2 === 0).map((hour) => (
                  <div key={hour} className="flex border-b border-slate-100" style={{ height: "80px" }}>
                    {/* Time Label */}
                    <div className="w-16 flex-shrink-0 pr-2 pt-0 text-right">
                      <span className="text-xs text-slate-400 -mt-2 block">
                        {formatHour(hour)}
                      </span>
                    </div>

                    {/* Day Columns */}
                    {weekDays.map((day, dayIndex) => {
                      const isToday = isSameDay(day, today);
                      const postsInSlot = postsByDateAndHour.get(`${day.toDateString()}-${hour}`) || [];
                      const postsInNextSlot = postsByDateAndHour.get(`${day.toDateString()}-${hour + 1}`) || [];
                      const allPosts = [...postsInSlot, ...postsInNextSlot];
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`flex-1 border-l border-slate-200 p-1 relative ${
                            isToday ? "bg-blue-50/30" : ""
                          }`}
                        >
                          {allPosts.map((post) => {
                            const postDate = post.scheduledFor
                              ? new Date(post.scheduledFor)
                              : new Date(post.createdAt);
                            const colors = statusColors[post.status] || statusColors.draft;
                            
                            return (
                              <div
                                key={post.id}
                                className={`mb-1 p-2 rounded-lg border ${colors.bg} ${colors.border} cursor-pointer hover:shadow-md transition-shadow`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[10px] text-slate-500">
                                        {platformIcon("twitter")}
                                      </span>
                                      <span className={`text-[10px] font-medium ${colors.text}`}>
                                        {postDate.toLocaleTimeString("en-US", {
                                          hour: "numeric",
                                          minute: "2-digit",
                                          hour12: true,
                                        })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-700 line-clamp-2 leading-tight">
                                      {post.content.substring(0, 60)}
                                      {post.content.length > 60 ? "..." : ""}
                                    </p>
                                  </div>
                                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                                    <div className="w-10 h-10 rounded bg-slate-200 flex-shrink-0 overflow-hidden">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={post.mediaUrls[0]}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
