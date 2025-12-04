/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/analytics/twitter.ts

export interface TwitterUserMetrics {
  id: string;
  username: string;
  name: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  listedCount: number;
  profileImageUrl: string;
}

export interface TwitterTweetMetrics {
  id: string;
  text: string;
  createdAt: string;
  authorId: string;
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

export interface TwitterAnalytics {
  user: TwitterUserMetrics;
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
 * Fetch user metrics from Twitter API
 */
export async function getTwitterUserMetrics(
  accessToken: string,
  userId: string
): Promise<TwitterUserMetrics> {
  const response = await fetch(
    `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics,profile_image_url`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to fetch user metrics: ${error.detail || error.title}`
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

/**
 * Fetch user's tweets with metrics
 */
export async function getTwitterUserTweets(
  accessToken: string,
  userId: string,
  maxResults: number = 100
): Promise<TwitterTweetMetrics[]> {
  const params = new URLSearchParams({
    max_results: Math.min(maxResults, 100).toString(),
    "tweet.fields":
      "created_at,public_metrics,organic_metrics,non_public_metrics",
    exclude: "retweets,replies",
  });

  const response = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch tweets: ${error.detail || error.title}`);
  }

  const data = await response.json();

  if (!data.data) {
    return [];
  }

  return data.data.map((tweet: any) => ({
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    authorId: userId,
    publicMetrics: {
      retweetCount: tweet.public_metrics.retweet_count,
      replyCount: tweet.public_metrics.reply_count,
      likeCount: tweet.public_metrics.like_count,
      quoteCount: tweet.public_metrics.quote_count,
      bookmarkCount: tweet.public_metrics.bookmark_count,
      impressionCount: tweet.public_metrics.impression_count || 0,
    },
    organicMetrics: tweet.organic_metrics
      ? {
          impressionCount: tweet.organic_metrics.impression_count,
          likeCount: tweet.organic_metrics.like_count,
          replyCount: tweet.organic_metrics.reply_count,
          retweetCount: tweet.organic_metrics.retweet_count,
          urlLinkClicks: tweet.organic_metrics.url_link_clicks || 0,
          userProfileClicks: tweet.organic_metrics.user_profile_clicks || 0,
        }
      : undefined,
    nonPublicMetrics: tweet.non_public_metrics
      ? {
          impressionCount: tweet.non_public_metrics.impression_count,
          urlLinkClicks: tweet.non_public_metrics.url_link_clicks || 0,
          userProfileClicks: tweet.non_public_metrics.user_profile_clicks || 0,
        }
      : undefined,
  }));
}

/**
 * Get tweet metrics by tweet ID
 */
export async function getTwitterTweetMetrics(
  accessToken: string,
  tweetId: string
): Promise<TwitterTweetMetrics> {
  const params = new URLSearchParams({
    "tweet.fields":
      "created_at,author_id,public_metrics,organic_metrics,non_public_metrics",
  });

  const response = await fetch(
    `https://api.twitter.com/2/tweets/${tweetId}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to fetch tweet metrics: ${error.detail || error.title}`
    );
  }

  const data = await response.json();
  const tweet = data.data;

  return {
    id: tweet.id,
    text: tweet.text,
    createdAt: tweet.created_at,
    authorId: tweet.author_id,
    publicMetrics: {
      retweetCount: tweet.public_metrics.retweet_count,
      replyCount: tweet.public_metrics.reply_count,
      likeCount: tweet.public_metrics.like_count,
      quoteCount: tweet.public_metrics.quote_count,
      bookmarkCount: tweet.public_metrics.bookmark_count,
      impressionCount: tweet.public_metrics.impression_count || 0,
    },
    organicMetrics: tweet.organic_metrics
      ? {
          impressionCount: tweet.organic_metrics.impression_count,
          likeCount: tweet.organic_metrics.like_count,
          replyCount: tweet.organic_metrics.reply_count,
          retweetCount: tweet.organic_metrics.retweet_count,
          urlLinkClicks: tweet.organic_metrics.url_link_clicks || 0,
          userProfileClicks: tweet.organic_metrics.user_profile_clicks || 0,
        }
      : undefined,
    nonPublicMetrics: tweet.non_public_metrics
      ? {
          impressionCount: tweet.non_public_metrics.impression_count,
          urlLinkClicks: tweet.non_public_metrics.url_link_clicks || 0,
          userProfileClicks: tweet.non_public_metrics.user_profile_clicks || 0,
        }
      : undefined,
  };
}

/**
 * Get comprehensive analytics for a Twitter account
 */
export async function getTwitterAnalytics(
  accessToken: string,
  userId: string,
  tweetLimit: number = 100
): Promise<TwitterAnalytics> {
  // Fetch user metrics and tweets in parallel
  const [user, tweets] = await Promise.all([
    getTwitterUserMetrics(accessToken, userId),
    getTwitterUserTweets(accessToken, userId, tweetLimit),
  ]);

  // Calculate summary statistics
  const totalImpressions = tweets.reduce(
    (sum, tweet) =>
      sum +
      (tweet.nonPublicMetrics?.impressionCount ||
        tweet.publicMetrics.impressionCount),
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

  const avgEngagementRate =
    totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

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
