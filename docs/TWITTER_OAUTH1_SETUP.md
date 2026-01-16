# Twitter OAuth 1.0a Setup for Media Upload

Twitter API v1.1 media upload endpoints (`upload.twitter.com/1.1/media/upload.json`) require OAuth 1.0a authentication, not OAuth 2.0 Bearer tokens.

## Implementation Status ✅

OAuth 1.0a flow has been fully implemented according to [X/Twitter documentation](https://docs.x.com/fundamentals/authentication/oauth-1-0a/obtaining-user-access-tokens).

### What Works

- **OAuth 2.0** (existing): Reading tweets, posting tweets (API v2), user profile
- **OAuth 1.0a** (new): Media upload to Twitter

### Architecture

The system now supports both OAuth flows:
- OAuth 2.0 tokens stored in `accessToken` field
- OAuth 1.0a tokens stored in `oauth1AccessToken` field
- OAuth 1.0a secret stored in `accessTokenSecret` field

## How to Use

### For Users

1. **Connect via OAuth 2.0** (existing flow):
   - Go to `/api/social/connect/twitter`
   - This provides access to API v2 endpoints

2. **Connect via OAuth 1.0a** (for media upload):
   - Go to `/api/social/connect/twitter-oauth1`
   - This provides OAuth 1.0a credentials needed for media upload
   - Can be done in addition to OAuth 2.0 connection

### For Developers

The OAuth 1.0a flow follows the 3-legged OAuth process:

1. **Step 1**: `GET /api/social/connect/twitter-oauth1`
   - Requests a request token from Twitter
   - Redirects user to Twitter authorization page

2. **Step 2**: User authorizes on Twitter
   - Twitter redirects to callback with `oauth_token` and `oauth_verifier`

3. **Step 3**: `GET /api/social/callback/twitter-oauth1`
   - Exchanges request token for access token and secret
   - Stores credentials in database

## Database Schema

```typescript
socialAccount {
  accessToken: string;        // OAuth 2.0 token (for API v2)
  oauth1AccessToken: string;  // OAuth 1.0a token (for media upload)
  accessTokenSecret: string;  // OAuth 1.0a secret (for media upload)
}
```

## Worker Integration

The worker automatically uses OAuth 1.0a credentials when uploading media:
- Checks for `oauth1AccessToken` and `accessTokenSecret`
- Falls back to `accessToken` if `oauth1AccessToken` not available
- Uses `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` as consumer credentials

## Configuration

Make sure these environment variables are set:
- `TWITTER_CLIENT_ID` - Consumer Key (API Key)
- `TWITTER_CLIENT_SECRET` - Consumer Secret (API Secret Key)
- `BETTER_AUTH_URL` - Base URL for callbacks

## Callback URL Setup

In Twitter Developer Portal:
1. Go to your app settings
2. Add callback URL: `https://yourdomain.com/api/social/callback/twitter-oauth1`
3. Save changes

## Migration

Run the database migration to add the new fields:
```bash
bun run db:push
```

## References

- [X/Twitter OAuth 1.0a Documentation](https://docs.x.com/fundamentals/authentication/oauth-1-0a/obtaining-user-access-tokens)
- [Twitter Media Upload API](https://developer.twitter.com/en/docs/tutorials/uploading-media)
