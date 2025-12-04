/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/social/twitter.ts
// All functions use user-context auth (connected user's token)
// This does NOT consume your app's rate limits!

interface TwitterUserContext {
  accessToken: string; // The connected user's OAuth token
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
    const error = await response.json();
    throw new Error(
      `Twitter API error: ${
        error.detail || error.title || JSON.stringify(error)
      }`
    );
  }

  const data = await response.json();
  const user = data.data;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    followersCount: user.public_metrics.followers_count,
    followingCount: user.public_metrics.following_count,
    tweetCount: user.public_metrics.tweet_count,
    listedCount: user.public_metrics.listed_count,
    profileImageUrl: user.profile_image_url,
  };
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
    const error = await response.json();

    // Provide more helpful error messages
    let errorMessage = error.detail || error.title || "Unknown error";

    if (response.status === 429) {
      errorMessage = "Rate limit exceeded. Please try again in 15 minutes.";
    } else if (response.status === 401 || response.status === 403) {
      errorMessage =
        "Authentication failed. Please reconnect your Twitter account.";
    } else if (error.errors && error.errors.length > 0) {
      errorMessage = error.errors[0].message;
    }

    throw new Error(`Twitter API error: ${errorMessage}`);
  }

  const data = await response.json();

  if (!data.data || data.data.length === 0) {
    return [];
  }

  return data.data.map((tweet: any) => ({
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    publicMetrics: {
      retweetCount: tweet.public_metrics?.retweet_count || 0,
      replyCount: tweet.public_metrics?.reply_count || 0,
      likeCount: tweet.public_metrics?.like_count || 0,
      quoteCount: tweet.public_metrics?.quote_count || 0,
      bookmarkCount: tweet.public_metrics?.bookmark_count || 0,
      impressionCount: tweet.public_metrics?.impression_count || 0,
    },
    // organic_metrics and non_public_metrics not available on Free tier
    organicMetrics: undefined,
    nonPublicMetrics: undefined,
  }));
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
    const error = await response.json();

    let errorMessage = error.detail || error.title || "Unknown error";

    if (response.status === 429) {
      errorMessage = "Rate limit exceeded. Please try again in 15 minutes.";
    } else if (response.status === 401 || response.status === 403) {
      errorMessage =
        "Authentication failed. Please reconnect your Twitter account.";
    } else if (error.errors && error.errors.length > 0) {
      errorMessage = error.errors[0].message;
    }

    throw new Error(`Twitter API error: ${errorMessage}`);
  }

  const data = await response.json();
  const tweet = data.data;

  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    publicMetrics: {
      retweetCount: tweet.public_metrics?.retweet_count || 0,
      replyCount: tweet.public_metrics?.reply_count || 0,
      likeCount: tweet.public_metrics?.like_count || 0,
      quoteCount: tweet.public_metrics?.quote_count || 0,
      bookmarkCount: tweet.public_metrics?.bookmark_count || 0,
      impressionCount: tweet.public_metrics?.impression_count || 0,
    },
    // These metrics not available on Free tier
    organicMetrics: undefined,
    nonPublicMetrics: undefined,
  };
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
    const error = await response.json();
    throw new Error(
      `Twitter API error: ${
        error.detail || error.title || JSON.stringify(error)
      }`
    );
  }

  const data = await response.json();
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
    const error = await response.json();
    throw new Error(
      `Twitter API error: ${
        error.detail || error.title || JSON.stringify(error)
      }`
    );
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
  // Create tweet with media IDs (already uploaded)
  const response = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
    const error = await response.json();
    throw new Error(
      `Twitter API error: ${error.detail || error.title || response.statusText}`
    );
  }

  const data = await response.json();
  return data.data.id;
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

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}
