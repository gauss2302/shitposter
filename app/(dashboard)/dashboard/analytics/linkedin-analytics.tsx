"use client";

import { useState, useEffect } from "react";
import type { SocialAccount } from "@/lib/db/schema";

interface LinkedInAnalyticsData {
  user: {
    id: string;
    name: string;
    headline: string;
    connectionsCount: number;
    followersCount: number;
    postCount: number;
    profileImageUrl: string;
  };
  posts: Array<{
    id: string;
    text: string;
    createdAt: string;
    metrics: {
      likes: number;
      comments: number;
      shares: number;
      impressions: number;
      clicks: number;
    };
  }>;
  summary: {
    totalImpressions: number;
    totalEngagements: number;
    totalReactions: number;
    totalComments: number;
    totalShares: number;
    avgEngagementRate: number;
  };
}

interface LinkedInAnalyticsProps {
  account: SocialAccount;
}

export function LinkedInAnalytics({ account }: LinkedInAnalyticsProps) {
  const [analytics, setAnalytics] = useState<LinkedInAnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call with mock data
    const timer = setTimeout(() => {
      setAnalytics({
        user: {
          id: account.platformUserId,
          name: account.platformUsername, // Fallback since we might not have full name
          headline: "Professional Shitposter | Growth Hacker",
          connectionsCount: 1543,
          followersCount: 2305,
          postCount: 45,
          profileImageUrl: account.profileImageUrl || "",
        },
        posts: Array.from({ length: 5 }).map((_, i) => ({
          id: `post-${i}`,
          text: "Just launched a new feature! 🚀 #coding #growth #startup",
          createdAt: new Date(Date.now() - i * 86400000).toISOString(),
          metrics: {
            likes: Math.floor(Math.random() * 500),
            comments: Math.floor(Math.random() * 50),
            shares: Math.floor(Math.random() * 20),
            impressions: Math.floor(Math.random() * 5000),
            clicks: Math.floor(Math.random() * 200),
          },
        })),
        summary: {
          totalImpressions: 15420,
          totalEngagements: 890,
          totalReactions: 650,
          totalComments: 120,
          totalShares: 45,
          avgEngagementRate: 3.2,
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
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading LinkedIn analytics...</p>
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl border-2 border-zinc-200 overflow-hidden">
          {analytics.user.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={analytics.user.profileImageUrl}
              alt={analytics.user.name}
              className="w-full h-full object-cover"
            />
          ) : (
            "👔"
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">
            {analytics.user.name}
          </h2>
          <p className="text-zinc-500">{analytics.user.headline}</p>
        </div>
      </div>

      {/* Profile Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Connections",
            value: formatNumber(analytics.user.connectionsCount),
          },
          {
            label: "Followers",
            value: formatNumber(analytics.user.followersCount),
          },
          {
            label: "Total Posts",
            value: formatNumber(analytics.user.postCount),
          },
          { label: "Profile Views", value: "1.2K" }, // Mock static
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

      {/* Summary Stats */}
      <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">
          Performance Summary (Last 30 Days)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              label: "Impressions",
              value: formatNumber(analytics.summary.totalImpressions),
              icon: "👁️",
            },
            {
              label: "Engagements",
              value: formatNumber(analytics.summary.totalEngagements),
              icon: "📊",
            },
            {
              label: "Reactions",
              value: formatNumber(analytics.summary.totalReactions),
              icon: "👍",
            },
            {
              label: "Comments",
              value: formatNumber(analytics.summary.totalComments),
              icon: "💬",
            },
            {
              label: "Shares",
              value: formatNumber(analytics.summary.totalShares),
              icon: "🔄",
            },
            {
              label: "Engagement Rate",
              value: `${analytics.summary.avgEngagementRate}%`,
              icon: "📈",
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
