"use client";

import { useState, useEffect } from "react";
import type { SocialAccount } from "@/lib/db/schema";

interface TikTokAnalyticsData {
  user: {
    username: string;
    followersCount: number;
    followingCount: number;
    likesCount: number;
    videoCount: number;
    profileImageUrl: string;
  };
  summary: {
    videoViews: number;
    profileViews: number;
    shares: number;
    comments: number;
    totalLikes: number;
    avgWatchTime: string;
  };
}

interface TikTokAnalyticsProps {
  account: SocialAccount;
}

export function TikTokAnalytics({ account }: TikTokAnalyticsProps) {
  const [analytics, setAnalytics] = useState<TikTokAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnalytics({
        user: {
          username: account.platformUsername,
          followersCount: 85000,
          followingCount: 120,
          likesCount: 1200000,
          videoCount: 340,
          profileImageUrl: account.profileImageUrl || "",
        },
        summary: {
          videoViews: 4500000,
          profileViews: 12000,
          shares: 45000,
          comments: 23000,
          totalLikes: 890000,
          avgWatchTime: "18s",
        },
      });
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [account]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading TikTok analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-2xl overflow-hidden border-2 border-zinc-200">
          {analytics.user.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={analytics.user.profileImageUrl}
              alt={analytics.user.username}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-white">🎵</span>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">
            @{analytics.user.username}
          </h2>
          <p className="text-zinc-500">TikTok Creator</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Followers",
            value: formatNumber(analytics.user.followersCount),
          },
          {
            label: "Total Likes",
            value: formatNumber(analytics.user.likesCount),
          },
          { label: "Videos", value: formatNumber(analytics.user.videoCount) },
          {
            label: "Profile Views",
            value: formatNumber(analytics.summary.profileViews),
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="bg-white border border-zinc-200 rounded-xl p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              {metric.label}
            </p>
            <p className="text-2xl font-bold text-zinc-900">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-linear-to-br from-zinc-100 to-zinc-200 rounded-2xl p-6 border border-zinc-300">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">
          Content Performance (Last 28 Days)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              label: "Video Views",
              value: formatNumber(analytics.summary.videoViews),
              icon: "▶️",
            },
            {
              label: "Likes",
              value: formatNumber(analytics.summary.totalLikes),
              icon: "❤️",
            },
            {
              label: "Comments",
              value: formatNumber(analytics.summary.comments),
              icon: "💬",
            },
            {
              label: "Shares",
              value: formatNumber(analytics.summary.shares),
              icon: "↗️",
            },
            {
              label: "Profile Views",
              value: formatNumber(analytics.summary.profileViews),
              icon: "👀",
            },
            {
              label: "Avg Watch Time",
              value: analytics.summary.avgWatchTime,
              icon: "⏱️",
            },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
              <p className="text-xs text-zinc-600 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
