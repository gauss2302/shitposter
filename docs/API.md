# Public API

Shitposter exposes a REST API at `/api/public/v1` for third-party tools
(Zapier, n8n, scripts, custom agents) that want to schedule, read,
update, and cancel posts without going through the dashboard.

The dashboard itself keeps using its own cookie-authenticated
`/api/v1/*` endpoints; nothing in this document applies there.

## Authentication

1. Create an API key in **Dashboard → Developer**. The raw token is shown
   exactly once — store it somewhere safe.
2. Pass the token as a bearer header (preferred) or via `X-API-Key`:

```bash
curl -H "Authorization: Bearer sp_live_<prefix>_<secret>" \
  https://your-backend.example.com/api/public/v1/me
```

The token format is `sp_live_<6-hex-prefix>_<32-hex-secret>`. Only the
prefix is stored verbatim; the secret portion is verified against a
SHA-256 hash, so we cannot recover it for you if you lose it.

## Plan gating

Every public-API request requires an **active subscription**. If your
plan lapses or is canceled, the API responds with `402 Payment Required`
until a plan is reactivated at `/dashboard/accounts`.

## Rate limits

Limits are evaluated per API key against a sliding window of
`PUBLIC_API_RATE_WINDOW_SECONDS` (default 60s). Reads and writes are
counted separately, and caps scale with your subscription plan:

| Plan       | Reads / min | Writes / min |
|------------|-------------|--------------|
| basic      | 60          | 10           |
| business   | 300         | 60           |
| enterprise | 1,500       | 300          |

Every response carries:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (UNIX epoch when the window resets)

When you exceed your quota you get `429 Too Many Requests` plus a
`Retry-After` header (in seconds).

## Scopes

| Scope                  | Endpoints that require it                            |
|------------------------|------------------------------------------------------|
| `accounts:read`        | `GET /capabilities`, `GET /accounts`                 |
| `posts:read`           | `GET /posts`, `GET /posts/{id}`                      |
| `posts:write`          | `POST/PATCH/DELETE /posts[/{id}]`                    |
| `ai:providers:read`    | `GET /ai/providers`                                  |
| `ai:providers:write`   | `POST/PATCH/DELETE /ai/providers[/{id}]`             |
| `ai:generate`          | `POST /ai/generate`                                  |

The wildcard scope `*` grants all of the above.

## Endpoints

### `GET /me`

Identifies the holder of the key.

```bash
curl -H "Authorization: Bearer $KEY" \
  https://your-backend.example.com/api/public/v1/me
```

```json
{
  "userId": "user_...",
  "apiKeyId": "key_...",
  "apiKeyName": "Zapier integration",
  "scopes": ["accounts:read", "posts:read", "posts:write"],
  "plan": "business"
}
```

### `GET /capabilities`

Lists every known social platform with its publishing support and text
limit.

```json
[
  { "platform": "twitter",   "publishSupported": true,  "textLimit": 280,  "mediaSupported": true,  "notes": null },
  { "platform": "linkedin",  "publishSupported": true,  "textLimit": 3000, "mediaSupported": false, "notes": null },
  { "platform": "tiktok",    "publishSupported": true,  "textLimit": 2200, "mediaSupported": true,  "notes": null },
  { "platform": "instagram", "publishSupported": true,  "textLimit": 2200, "mediaSupported": true,  "notes": null }
]
```

### `GET /accounts`

Returns the caller's active connected social accounts.

### `GET /posts?limit=&cursor=&status=`

Paginated list of the caller's posts.

- `limit` — default 50, max 100.
- `cursor` — opaque base64 string returned in `nextCursor` from the
  previous page. Omit to start from the most recent post.
- `status` — optional filter (e.g. `scheduled`, `published`, `failed`,
  `cancelled`).

```json
{
  "items": [...PublicPostResponse...],
  "nextCursor": "MjAyNi0wNi0xNlQxODozMDowMHwxYWJj..."
}
```

### `GET /posts/{post_id}`

Returns one post and its per-platform targets.

### `POST /posts`

Create a post. Uses `multipart/form-data` — pass attached media as one
or more `media` parts; the server uploads them to object storage and
hands stable URLs to the publishing worker.

```bash
curl -X POST https://your-backend.example.com/api/public/v1/posts \
  -H "Authorization: Bearer $KEY" \
  -F content="Launching today" \
  -F socialAccountIds='["acc_123","acc_456"]' \
  -F scheduledFor="2026-06-20T18:00:00Z" \
  -F media=@./cover.jpg
```

| Field              | Notes                                                                 |
|--------------------|-----------------------------------------------------------------------|
| `content`          | Optional if media is attached.                                        |
| `socialAccountIds` | JSON array of account IDs to publish to.                              |
| `scheduledFor`     | ISO-8601 datetime. Omit to publish immediately.                       |
| `media`            | Repeated file fields. `image/*` and `video/*` only. ≤ 4 GB per file. |

Response: `201 Created` with the new post and a target per account.

### `PATCH /posts/{post_id}`

Update a `scheduled` post before it leaves for the platform. Allowed
fields:

```json
{
  "content": "Updated copy",
  "scheduledFor": "2026-06-20T19:30:00Z"
}
```

Rules:

- `409 Conflict` if `post.status` is not `scheduled`.
- `409 Conflict` if any target already started publishing
  (`status != "pending"`).
- Updating `scheduledFor` re-dispatches the worker job; the previously
  enqueued job no-ops via the dispatch-token guard.

### `DELETE /posts/{post_id}`

Cancel a `scheduled` post.

- Returns `204 No Content` on success.
- Sets `post.status` and every target to `"cancelled"`.
- `409 Conflict` if the post is past the `scheduled` stage.

The worker checks the post / target status before publishing; even if a
deferred job has already been enqueued, it will short-circuit silently
once the row is cancelled.

### `GET /ai/providers`

List your encrypted AI provider credentials (OpenAI, Anthropic, or an
OpenAI-compatible endpoint).

### `POST /ai/providers`

```json
{
  "provider": "openai",
  "displayName": "Brand voice",
  "apiKey": "sk-...",
  "defaultModel": "gpt-4o-mini",
  "baseUrl": null
}
```

### `PATCH /ai/providers/{id}`

Update any subset of `displayName`, `apiKey`, `defaultModel`, `baseUrl`,
or `isActive`.

### `DELETE /ai/providers/{id}`

Permanently delete the credential record. `204 No Content` on success.

### `POST /ai/generate`

Generate candidate post copy for one or more platforms. Returns the
candidates; nothing is published automatically — send the chosen one to
`POST /posts` afterwards.

```bash
curl -X POST https://your-backend.example.com/api/public/v1/ai/generate \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Announce our public API",
    "platforms": ["twitter", "linkedin"],
    "tone": "confident and useful",
    "maxCandidates": 2
  }'
```

## Status values

`PublicPostResponse.status` is one of:

| Status       | Meaning                                                       |
|--------------|---------------------------------------------------------------|
| `draft`      | Created but not yet sent anywhere (rare via the public API).  |
| `scheduled`  | Queued; will publish at `scheduledFor`.                       |
| `publishing` | At least one target is mid-flight.                            |
| `published`  | Every target succeeded.                                       |
| `failed`     | All targets failed (mixed states resolve to `published`).     |
| `cancelled`  | Cancelled via `DELETE /posts/{id}` before publishing started. |

`PublicPostTargetResponse.status` mirrors that lifecycle per platform:
`pending`, `publishing`, `published`, `failed`, `cancelled`.

## Errors

Errors use FastAPI's standard JSON envelope:

```json
{ "detail": "Insufficient scope" }
```

| Code | Meaning                                                                  |
|------|--------------------------------------------------------------------------|
| 400  | Validation error (bad body, malformed JSON in `socialAccountIds`, etc.). |
| 401  | Missing or invalid API key.                                              |
| 402  | No active subscription — visit `/dashboard/accounts`.                    |
| 403  | API key is missing the scope required for the route.                     |
| 404  | Post / credential / account not found or not owned by you.               |
| 409  | Mutation conflicts with current state (e.g. PATCH on a published post).  |
| 422  | Request body shape doesn't match the schema.                             |
| 429  | Rate limit exceeded. See `Retry-After` and `X-RateLimit-*` headers.      |
| 503  | Object storage isn't configured server-side; report to operators.        |
