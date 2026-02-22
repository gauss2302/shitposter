// lib/queue/publishers/twitter.ts
// Re-exports and extends Twitter API with publish/refresh; uses user-context auth.

import { logger } from "@/lib/logger";
import {
  parseTwitterRateLimitHeaders,
  TwitterRateLimitError,
} from "@/lib/social/twitter";
import type {
  TwitterApiErrorRaw,
  TwitterApiV2UserRaw,
  TwitterApiV2UserResponse,
  TwitterApiV2TweetRaw,
  TwitterApiV2TweetsResponse,
  TwitterApiV2SingleTweetResponse,
  TwitterApiV2PostTweetResponse,
  TwitterApiOAuth2TokenResponse,
} from "@/lib/social/twitter-types";

interface TwitterUserContext {
  accessToken: string; // The connected user's OAuth token
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

  parseTwitterRateLimitHeaders(response.headers);
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
    const error = (await response.json()) as TwitterApiErrorRaw;
    throw new Error(`Twitter API error: ${getTwitterErrorMessage(error, response.status)}`);
  }

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

interface PublishOptions {
  accessToken: string;
  content: string;
  mediaIds?: string[]; // Changed from mediaUrls to mediaIds
}

export async function publishToTwitter({
  accessToken,
  content,
  mediaIds,
}: PublishOptions): Promise<string> {
  // Validate content - Twitter requires at least some content or media
  if (!content?.trim() && (!mediaIds || mediaIds.length === 0)) {
    throw new Error("Twitter requires either text content or media");
  }

  // Validate content length
  if (content && content.length > 280) {
    throw new Error("Twitter content exceeds 280 character limit");
  }

  // Validate media count
  if (mediaIds && mediaIds.length > 4) {
    throw new Error("Twitter allows maximum 4 media items per tweet");
  }

  const requestBody = {
    text: content || "",
    ...(mediaIds &&
      mediaIds.length > 0 && {
        media: { media_ids: mediaIds },
      }),
  };

  logger.debug("Twitter API request", {
    contentLength: content?.length || 0,
    mediaCount: mediaIds?.length || 0,
  });

  // Create tweet with media IDs (already uploaded)
  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  let errorData: TwitterApiErrorRaw | null = null;

  try {
    errorData = JSON.parse(responseText) as TwitterApiErrorRaw;
  } catch {
    // Response is not JSON
  }

  if (!response.ok) {
    const rateLimit = parseTwitterRateLimitHeaders(response.headers);
    logger.error("Twitter API error response", {
      status: response.status,
      statusText: response.statusText,
      parsed: errorData,
      ...(response.status === 429 && rateLimit && {
        rateLimitError: true,
        rateLimit,
      }),
    });

    const errorMessage =
      errorData?.detail ??
      errorData?.title ??
      (errorData?.errors?.[0]?.message) ??
      response.statusText ??
      "Unknown Twitter API error";

    if (response.status === 429 && rateLimit) {
      throw new TwitterRateLimitError(errorMessage, rateLimit);
    }
    throw new Error(`Twitter API error: ${errorMessage}`);
  }

  const rateLimit = parseTwitterRateLimitHeaders(response.headers);
  if (rateLimit) {
    logger.debug("Twitter API rate limit", rateLimit);
  }

  let data: TwitterApiV2PostTweetResponse;
  try {
    data = JSON.parse(responseText) as TwitterApiV2PostTweetResponse;
  } catch {
    logger.error("Failed to parse Twitter API response");
    throw new Error("Invalid response from Twitter API");
  }

  // Validate response structure
  if (!data) {
    logger.error("Twitter API returned empty response");
    throw new Error("Empty response from Twitter API");
  }

  if (!data.data) {
    logger.error("Twitter API response missing 'data' field");
    throw new Error("Invalid response structure from Twitter API");
  }

  if (!data.data.id) {
    logger.error("Twitter API response missing 'data.id' field");
    throw new Error("Twitter API did not return a tweet ID");
  }

  const tweetId = data.data.id;
  logger.debug("Twitter API success", { tweetId });

  // Verify the tweet was actually created by fetching it back
  try {
    const verifyResponse = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=created_at,text`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      logger.debug("Tweet verification successful", {
        tweetId,
        text: verifyData.data?.text,
      });
    } else {
      logger.warn("Could not verify tweet (may still be processing)", {
        status: verifyResponse.status,
        tweetId,
      });
    }
  } catch (verifyError) {
    logger.warn("Tweet verification failed (tweet may still exist)", verifyError);
  }

  return tweetId;
}

// Refresh Twitter access token
export async function refreshTwitterToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Twitter token: ${error}`);
  }

  const data = (await response.json()) as TwitterApiOAuth2TokenResponse;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
