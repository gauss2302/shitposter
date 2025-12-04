"use client";

import { useState, useEffect } from "react";
import type { SocialAccount } from "@/lib/db/schema";

interface InstagramAnalyticsData {
  user: {
    username: string;
    followersCount: number;
    followingCount: number;
    mediaCount: number;
    profileImageUrl: string;
  };
  summary: {
    reach: number;
    impressions: number;
    profileVisits: number;
    websiteClicks: number;
    totalInteractions: number;
    avgEngagementRate: number;
  };
}

interface InstagramAnalyticsProps {
  account: SocialAccount;
}

export function InstagramAnalytics({ account }: InstagramAnalyticsProps) {
  const [analytics, setAnalytics] = useState<InstagramAnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnalytics({
        user: {
          username: account.platformUsername,
          followersCount: 12500,
          followingCount: 450,
          mediaCount: 128,
          profileImageUrl: account.profileImageUrl || "",
        },
        summary: {
          reach: 45000,
          impressions: 68000,
          profileVisits: 3200,
          websiteClicks: 450,
          totalInteractions: 5600,
          avgEngagementRate: 4.8,
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
          <div className="w-16 h-16 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading Instagram analytics...</p>
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
        <div className="w-16 h-16 rounded-full bg-linear-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px]">
          <div className="w-full h-full rounded-full bg-white p-[2px] overflow-hidden">
            {analytics.user.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={analytics.user.profileImageUrl}
                alt={analytics.user.username}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-xl">
                📸
              </div>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">
            @{analytics.user.username}
          </h2>
          <p className="text-zinc-500">Instagram Business</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Followers",
            value: formatNumber(analytics.user.followersCount),
          },
          {
            label: "Following",
            value: formatNumber(analytics.user.followingCount),
          },
          { label: "Posts", value: formatNumber(analytics.user.mediaCount) },
          { label: "Reach", value: formatNumber(analytics.summary.reach) },
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

      <div className="bg-linear-to-br from-pink-50 to-purple-50 rounded-2xl p-6 border border-pink-200">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">
          Insights Overview (Last 30 Days)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              label: "Impressions",
              value: formatNumber(analytics.summary.impressions),
              icon: "👀",
            },
            {
              label: "Interactions",
              value: formatNumber(analytics.summary.totalInteractions),
              icon: "❤️",
            },
            {
              label: "Profile Visits",
              value: formatNumber(analytics.summary.profileVisits),
              icon: "👤",
            },
            {
              label: "Link Clicks",
              value: formatNumber(analytics.summary.websiteClicks),
              icon: "🔗",
            },
            {
              label: "Reach",
              value: formatNumber(analytics.summary.reach),
              icon: "📡",
            },
            {
              label: "Engagement",
              value: `${analytics.summary.avgEngagementRate}%`,
              icon: "🔥",
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
