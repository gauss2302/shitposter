"use client";

import { useState, useEffect } from "react";
import type { SocialAccount } from "@/lib/db/schema";

interface TwitterAnalytics {
  user: {
    id: string;
    username: string;
    name: string;
    followersCount: number;
    followingCount: number;
    tweetCount: number;
    listedCount: number;
    profileImageUrl: string;
  };
  tweets: Array<{
    id: string;
    text: string;
    createdAt: string;
    publicMetrics: {
      retweetCount: number;
      replyCount: number;
      likeCount: number;
      quoteCount: number;
      bookmarkCount: number;
      impressionCount: number;
    };
  }>;
  summary: {
    totalTweets: number;
    totalImpressions: number;
    totalEngagements: number;
    totalLikes: number;
    totalRetweets: number;
    totalReplies: number;
    avgEngagementRate: number;
  };
}

interface TwitterAnalyticsProps {
  account: SocialAccount;
}

export function TwitterAnalytics({ account }: TwitterAnalyticsProps) {
  const [analytics, setAnalytics] = useState<TwitterAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tweetLimit, setTweetLimit] = useState(50);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/analytics/twitter/${account.id}?limit=${tweetLimit}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch analytics");
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [account.id, tweetLimit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-red-900 mb-1">
              Error Loading Analytics
            </h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header with Account Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={analytics.user.profileImageUrl}
            alt={analytics.user.name}
            className="w-16 h-16 rounded-full border-2 border-zinc-200"
          />
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">
              {analytics.user.name}
            </h2>
            <p className="text-zinc-500">@{analytics.user.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={tweetLimit}
            onChange={(e) => setTweetLimit(Number(e.target.value))}
            className="px-3 py-2 border border-zinc-300 rounded-lg text-sm"
          >
            <option value={10}>Last 10 tweets</option>
            <option value={25}>Last 25 tweets</option>
            <option value={50}>Last 50 tweets</option>
            <option value={100}>Last 100 tweets</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Profile Metrics */}
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
          {
            label: "Total Tweets",
            value: formatNumber(analytics.user.tweetCount),
          },
          { label: "Listed", value: formatNumber(analytics.user.listedCount) },
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
      <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-2xl p-6 border border-violet-200">
        <h3 className="text-lg font-bold text-zinc-900 mb-4">
          Performance Summary (Last {analytics.summary.totalTweets} Tweets)
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
              icon: "💬",
            },
            {
              label: "Likes",
              value: formatNumber(analytics.summary.totalLikes),
              icon: "❤️",
            },
            {
              label: "Retweets",
              value: formatNumber(analytics.summary.totalRetweets),
              icon: "🔄",
            },
            {
              label: "Replies",
              value: formatNumber(analytics.summary.totalReplies),
              icon: "💭",
            },
            {
              label: "Engagement Rate",
              value: `${analytics.summary.avgEngagementRate.toFixed(2)}%`,
              icon: "📊",
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

      {/* Top Tweets */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-6 border-b border-zinc-200">
          <h3 className="text-lg font-bold text-zinc-900">
            Top Performing Tweets
          </h3>
          <p className="text-sm text-zinc-500">Sorted by total engagements</p>
        </div>

        <div className="divide-y divide-zinc-100">
          {analytics.tweets
            .sort((a, b) => {
              const engagementA =
                a.publicMetrics.likeCount +
                a.publicMetrics.retweetCount +
                a.publicMetrics.replyCount;
              const engagementB =
                b.publicMetrics.likeCount +
                b.publicMetrics.retweetCount +
                b.publicMetrics.replyCount;
              return engagementB - engagementA;
            })
            .slice(0, 10)
            .map((tweet) => {
              const totalEngagement =
                tweet.publicMetrics.likeCount +
                tweet.publicMetrics.retweetCount +
                tweet.publicMetrics.replyCount +
                tweet.publicMetrics.quoteCount;

              const engagementRate =
                tweet.publicMetrics.impressionCount > 0
                  ? (totalEngagement / tweet.publicMetrics.impressionCount) *
                    100
                  : 0;

              return (
                <div key={tweet.id} className="p-6 hover:bg-zinc-50 transition">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <p className="text-zinc-900 leading-relaxed flex-1">
                      {tweet.text.length > 200
                        ? tweet.text.slice(0, 200) + "..."
                        : tweet.text}
                    </p>
                    <a
                      href={`https://twitter.com/${analytics.user.username}/status/${tweet.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 hover:text-violet-700 flex-shrink-0"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span>
                      {new Date(tweet.createdAt).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      👁️ {formatNumber(tweet.publicMetrics.impressionCount)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      ❤️ {formatNumber(tweet.publicMetrics.likeCount)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      🔄 {formatNumber(tweet.publicMetrics.retweetCount)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      💬 {formatNumber(tweet.publicMetrics.replyCount)}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-violet-600">
                      {engagementRate.toFixed(2)}% ER
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
