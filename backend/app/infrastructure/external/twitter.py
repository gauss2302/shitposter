from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class TwitterRateLimitError(Exception):
    message: str
    retry_after: int = 900


def _error_message(payload: dict[str, Any], status_code: int) -> str:
    if status_code == 429:
        return "Rate limit exceeded. Please try again in 15 minutes."
    if status_code in {401, 403}:
        return "Authentication failed. Please reconnect your Twitter account."
    errors = payload.get("errors")
    if isinstance(errors, list) and errors:
        first = errors[0]
        if isinstance(first, dict) and first.get("message"):
            return str(first["message"])
    return str(payload.get("detail") or payload.get("title") or "Twitter API error")


async def _twitter_get(access_token: str, url: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers={"Authorization": f"Bearer {access_token}"})
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if response.status_code == 429:
        raise TwitterRateLimitError(_error_message(payload, response.status_code))
    if not response.is_success:
        raise RuntimeError(_error_message(payload, response.status_code))
    return payload


def _map_profile(raw: dict[str, Any]) -> dict[str, Any]:
    metrics = raw.get("public_metrics") or {}
    return {
        "id": raw.get("id", ""),
        "username": raw.get("username", ""),
        "name": raw.get("name", ""),
        "followersCount": metrics.get("followers_count", 0),
        "followingCount": metrics.get("following_count", 0),
        "tweetCount": metrics.get("tweet_count", 0),
        "listedCount": metrics.get("listed_count", 0),
        "profileImageUrl": raw.get("profile_image_url", ""),
    }


def _map_tweet(raw: dict[str, Any]) -> dict[str, Any]:
    metrics = raw.get("public_metrics") or {}
    return {
        "id": raw.get("id", ""),
        "text": raw.get("text", ""),
        "createdAt": raw.get("created_at"),
        "publicMetrics": {
            "retweetCount": metrics.get("retweet_count", 0),
            "replyCount": metrics.get("reply_count", 0),
            "likeCount": metrics.get("like_count", 0),
            "quoteCount": metrics.get("quote_count", 0),
            "bookmarkCount": metrics.get("bookmark_count", 0),
            "impressionCount": metrics.get("impression_count", 0),
        },
    }


async def get_twitter_analytics(access_token: str, tweet_limit: int) -> dict[str, Any]:
    profile_payload = await _twitter_get(
        access_token,
        "https://api.twitter.com/2/users/me?user.fields=public_metrics,profile_image_url",
    )
    tweets_payload = await _twitter_get(
        access_token,
        "https://api.twitter.com/2/users/me/tweets?"
        f"max_results={min(tweet_limit, 100)}&tweet.fields=created_at,public_metrics",
    )
    user = _map_profile(profile_payload["data"])
    tweets = [_map_tweet(tweet) for tweet in tweets_payload.get("data") or []]
    total_impressions = sum(tweet["publicMetrics"]["impressionCount"] for tweet in tweets)
    total_engagements = sum(
        tweet["publicMetrics"]["likeCount"]
        + tweet["publicMetrics"]["retweetCount"]
        + tweet["publicMetrics"]["replyCount"]
        + tweet["publicMetrics"]["quoteCount"]
        for tweet in tweets
    )
    total_likes = sum(tweet["publicMetrics"]["likeCount"] for tweet in tweets)
    total_retweets = sum(tweet["publicMetrics"]["retweetCount"] for tweet in tweets)
    total_replies = sum(tweet["publicMetrics"]["replyCount"] for tweet in tweets)
    avg_engagement_rate = (
        (total_engagements / total_impressions) * 100
        if total_impressions > 0
        else (total_engagements / len(tweets) if tweets else 0)
    )
    return {
        "user": user,
        "tweets": tweets,
        "summary": {
            "totalTweets": len(tweets),
            "totalImpressions": total_impressions,
            "totalEngagements": total_engagements,
            "totalLikes": total_likes,
            "totalRetweets": total_retweets,
            "totalReplies": total_replies,
            "avgEngagementRate": avg_engagement_rate,
        },
    }


async def post_tweet(
    *,
    access_token: str,
    content: str,
    media_ids: list[str] | None = None,
) -> str:
    payload: dict[str, Any] = {"text": content}
    if media_ids:
        payload["media"] = {"media_ids": media_ids}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.twitter.com/2/tweets",
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    try:
        body = response.json()
    except ValueError:
        body = {}
    if response.status_code == 429:
        raise TwitterRateLimitError(_error_message(body, response.status_code))
    if not response.is_success:
        raise RuntimeError(_error_message(body, response.status_code))
    return str(body.get("data", {}).get("id", ""))
