// lib/social/twitter.ts
// All functions use user-context auth (connected user's token)
// This does NOT consume your app's rate limits!

import type {
  TwitterApiErrorRaw,
  TwitterApiV2UserRaw,
  TwitterApiV2UserResponse,
  TwitterApiV2TweetRaw,
  TwitterApiV2TweetsResponse,
  TwitterApiV2SingleTweetResponse,
  TwitterApiV2PostTweetResponse,
  TwitterRateLimit,
} from "./twitter-types";

interface TwitterUserContext {
  accessToken: string; // The connected user's OAuth token
}

/**
 * Parse Twitter API rate limit headers from a response.
 * Returns null if headers are missing or invalid.
 */
export function parseTwitterRateLimitHeaders(headers: Headers): TwitterRateLimit | null {
  const limit = headers.get("x-rate-limit-limit");
  const remaining = headers.get("x-rate-limit-remaining");
  const reset = headers.get("x-rate-limit-reset");
  if (limit === null || remaining === null || reset === null) return null;
  const limitNum = parseInt(limit, 10);
  const remainingNum = parseInt(remaining, 10);
  const resetNum = parseInt(reset, 10);
  if (Number.isNaN(limitNum) || Number.isNaN(remainingNum) || Number.isNaN(resetNum))
    return null;
  return { limit: limitNum, remaining: remainingNum, reset: resetNum };
}

/** Error thrown when Twitter API returns 429 with rate limit info attached. */
export class TwitterRateLimitError extends Error {
  readonly rateLimitError = true;
  readonly rateLimit: TwitterRateLimit;
  constructor(message: string, rateLimit: TwitterRateLimit) {
    super(message);
    this.name = "TwitterRateLimitError";
    this.rateLimit = rateLimit;
  }
}

function getTwitterErrorMessage(error: TwitterApiErrorRaw, status: number): string {
  if (status === 429) return "Rate limit exceeded. Please try again in 15 minutes.";
  if (status === 401 || status === 403)
    return "Authentication failed. Please reconnect your Twitter account.";
  if (error.errors?.length) return error.errors[0].message;
  return error.detail ?? error.title ?? "Unknown error";
}

function mapUserRawToProfile(user: TwitterApiV2UserRaw): TwitterUserProfile {
  const metrics = user.public_metrics;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    followersCount: metrics?.followers_count ?? 0,
    followingCount: metrics?.following_count ?? 0,
    tweetCount: metrics?.tweet_count ?? 0,
    listedCount: metrics?.listed_count ?? 0,
    profileImageUrl: user.profile_image_url ?? "",
  };
}

function mapTweetRawToMetrics(tweet: TwitterApiV2TweetRaw): TwitterTweetMetrics {
  const pm = tweet.public_metrics;
  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    publicMetrics: {
      retweetCount: pm?.retweet_count ?? 0,
      replyCount: pm?.reply_count ?? 0,
      likeCount: pm?.like_count ?? 0,
      quoteCount: pm?.quote_count ?? 0,
      bookmarkCount: pm?.bookmark_count ?? 0,
      impressionCount: pm?.impression_count ?? 0,
    },
    organicMetrics: undefined,
    nonPublicMetrics: undefined,
  };
}

// ============================================
// PROFILE & USER INFO
// ============================================

export interface TwitterUserProfile {
  id: string;
  username: string;
  name: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  profileImageUrl: string;
}

/**
 * Get authenticated user's profile
 * Uses /users/me endpoint - counts against user's quota, not yours!
 */
export async function getUserProfile(
  context: TwitterUserContext
): Promise<TwitterUserProfile> {
  const response = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url",
    {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const rateLimit = parseTwitterRateLimitHeaders(response.headers);
    const error = (await response.json()) as TwitterApiErrorRaw;
    if (response.status === 429 && rateLimit) {
      throw new TwitterRateLimitError(
        getTwitterErrorMessage(error, response.status),
        rateLimit
      );
    }
    throw new Error(`Twitter API error: ${getTwitterErrorMessage(error, response.status)}`);
  }

  parseTwitterRateLimitHeaders(response.headers); // optional: could log in callers
  const data = (await response.json()) as TwitterApiV2UserResponse;
  return mapUserRawToProfile(data.data);
}

// ============================================
// TWEETS & POSTING
// ============================================

export interface TwitterTweetMetrics {
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
  organicMetrics?: {
    impressionCount: number;
    likeCount: number;
    replyCount: number;
    retweetCount: number;
    urlLinkClicks: number;
    userProfileClicks: number;
  };
  nonPublicMetrics?: {
    impressionCount: number;
    urlLinkClicks: number;
    userProfileClicks: number;
  };
}

/**
 * Get user's own tweets with full metrics
 * Uses /users/me/tweets endpoint
 */
export async function getUserTweets(
  context: TwitterUserContext,
  options?: {
    maxResults?: number;
    sinceId?: string;
    untilId?: string;
  }
): Promise<TwitterTweetMetrics[]> {
  const params = new URLSearchParams({
    max_results: String(Math.min(options?.maxResults || 100, 100)),
    // Only request basic fields that work with Free tier
    "tweet.fields": "created_at,public_metrics",
  });

  if (options?.sinceId) params.append("since_id", options.sinceId);
  if (options?.untilId) params.append("until_id", options.untilId);
  // Don't use exclude parameter - it may not be supported

  const response = await fetch(
    `https://api.twitter.com/2/users/me/tweets?${params}`,
    {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const rateLimit = parseTwitterRateLimitHeaders(response.headers);
    const error = (await response.json()) as TwitterApiErrorRaw;
    if (response.status === 429 && rateLimit) {
      throw new TwitterRateLimitError(
        getTwitterErrorMessage(error, response.status),
        rateLimit
      );
    }
    throw new Error(`Twitter API error: ${getTwitterErrorMessage(error, response.status)}`);
  }

  parseTwitterRateLimitHeaders(response.headers);
  const data = (await response.json()) as TwitterApiV2TweetsResponse;
  if (!data.data?.length) return [];
  return data.data.map(mapTweetRawToMetrics);
}

/**
 * Get a specific tweet by ID with metrics
 */
export async function getTweetById(
  context: TwitterUserContext,
  tweetId: string
): Promise<TwitterTweetMetrics> {
  const params = new URLSearchParams({
    // Only request fields available on Free tier
    "tweet.fields": "created_at,public_metrics",
  });

  const response = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const rateLimit = parseTwitterRateLimitHeaders(response.headers);
    const error = (await response.json()) as TwitterApiErrorRaw;
    if (response.status === 429 && rateLimit) {
      throw new TwitterRateLimitError(
        getTwitterErrorMessage(error, response.status),
        rateLimit
      );
    }
    throw new Error(`Twitter API error: ${getTwitterErrorMessage(error, response.status)}`);
  }

  parseTwitterRateLimitHeaders(response.headers);
  const data = (await response.json()) as TwitterApiV2SingleTweetResponse;
  return mapTweetRawToMetrics(data.data);
}

/**
 * Post a tweet
 */
export async function postTweet(
  context: TwitterUserContext,
  content: string,
  mediaIds?: string[]
): Promise<string> {
  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: content,
      ...(mediaIds &&
        mediaIds.length > 0 && {
          media: { media_ids: mediaIds },
        }),
    }),
  });

  if (!response.ok) {
    const rateLimit = parseTwitterRateLimitHeaders(response.headers);
    const error = (await response.json()) as TwitterApiErrorRaw;
    if (response.status === 429 && rateLimit) {
      throw new TwitterRateLimitError(
        getTwitterErrorMessage(error, response.status),
        rateLimit
      );
    }
    throw new Error(`Twitter API error: ${getTwitterErrorMessage(error, response.status)}`);
  }

  parseTwitterRateLimitHeaders(response.headers);
  const data = (await response.json()) as TwitterApiV2PostTweetResponse;
  return data.data.id;
}

/**
 * Delete a tweet (user can only delete their own)
 */
export async function deleteTweet(
  context: TwitterUserContext,
  tweetId: string
): Promise<void> {
  const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
    },
  });

  if (!response.ok) {
    const rateLimit = parseTwitterRateLimitHeaders(response.headers);
    const error = (await response.json()) as TwitterApiErrorRaw;
    if (response.status === 429 && rateLimit) {
      throw new TwitterRateLimitError(
        getTwitterErrorMessage(error, response.status),
        rateLimit
      );
    }
    throw new Error(`Twitter API error: ${getTwitterErrorMessage(error, response.status)}`);
  }
}

// ============================================
// ANALYTICS
// ============================================

export interface TwitterAnalytics {
  user: TwitterUserProfile;
  tweets: TwitterTweetMetrics[];
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

/**
 * Get comprehensive analytics for authenticated user
 * All data fetched using user's token - counts against THEIR quota!
 */
export async function getTwitterAnalytics(
  context: TwitterUserContext,
  tweetLimit: number = 100
): Promise<TwitterAnalytics> {
  // Fetch user profile and tweets in parallel
  const [user, tweets] = await Promise.all([
    getUserProfile(context),
    getUserTweets(context, { maxResults: tweetLimit }),
  ]);

  // Calculate summary statistics
  // Note: impressionCount may be 0 on Free tier
  const totalImpressions = tweets.reduce(
    (sum, tweet) => sum + (tweet.publicMetrics.impressionCount || 0),
    0
  );

  const totalEngagements = tweets.reduce(
    (sum, tweet) =>
      sum +
      tweet.publicMetrics.likeCount +
      tweet.publicMetrics.retweetCount +
      tweet.publicMetrics.replyCount +
      tweet.publicMetrics.quoteCount,
    0
  );

  const totalLikes = tweets.reduce(
    (sum, tweet) => sum + tweet.publicMetrics.likeCount,
    0
  );

  const totalRetweets = tweets.reduce(
    (sum, tweet) => sum + tweet.publicMetrics.retweetCount,
    0
  );

  const totalReplies = tweets.reduce(
    (sum, tweet) => sum + tweet.publicMetrics.replyCount,
    0
  );

  // Calculate engagement rate
  // If impressions data is not available (Free tier), calculate based on total engagement
  const avgEngagementRate =
    totalImpressions > 0
      ? (totalEngagements / totalImpressions) * 100
      : tweets.length > 0
      ? totalEngagements / tweets.length // Avg engagements per tweet instead
      : 0;

  return {
    user,
    tweets,
    summary: {
      totalTweets: tweets.length,
      totalImpressions,
      totalEngagements,
      totalLikes,
      totalRetweets,
      totalReplies,
      avgEngagementRate,
    },
  };
}
