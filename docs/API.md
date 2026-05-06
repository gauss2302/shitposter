# Agent API and AI Integration

Shitposter exposes a JSON API for external agents under `/api/v1/agent`.
Browser users continue to use cookie sessions; agents should use scoped API keys.

## Authentication

Create an API key in **Dashboard → API**. The raw token is shown once.

Use it as a bearer token:

```bash
curl -H "Authorization: Bearer sp_live_<prefix>_<secret>" \
  https://your-backend.example.com/api/v1/agent/me
```

`X-API-Key` is also supported for simple clients.

## Scopes

- `accounts:read` — read social accounts and platform capabilities.
- `posts:read` — read posts and target statuses.
- `posts:write` — create scheduled or immediate posts.
- `ai:generate` — request AI-generated content.

## Platform capabilities

The platform model is agnostic, but live publishing adapters are explicit.
Currently enabled publishing adapters are:

- `twitter`
- `linkedin`

Use capabilities before selecting targets:

```bash
curl -H "Authorization: Bearer $SHITPOSTER_API_KEY" \
  https://your-backend.example.com/api/v1/agent/social/capabilities
```

## List accounts

```bash
curl -H "Authorization: Bearer $SHITPOSTER_API_KEY" \
  https://your-backend.example.com/api/v1/agent/social/accounts
```

## Schedule a post

```bash
curl -X POST https://your-backend.example.com/api/v1/agent/posts \
  -H "Authorization: Bearer $SHITPOSTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Scheduled from an external agent.",
    "socialAccountIds": ["account_id_here"],
    "scheduledFor": "2026-05-06T18:30:00Z"
  }'
```

Omit `scheduledFor` to publish immediately. Media can be supplied as base64:

```json
{
  "content": "Post with media",
  "socialAccountIds": ["account_id_here"],
  "media": [
    {
      "data": "base64-encoded-bytes",
      "mimeType": "image/png"
    }
  ]
}
```

## Check status

```bash
curl -H "Authorization: Bearer $SHITPOSTER_API_KEY" \
  https://your-backend.example.com/api/v1/agent/posts/post_id_here
```

Post targets expose per-platform status and errors.

## AI generation

Add an AI provider in **Dashboard → AI** or configure server defaults:

- `OPENAI_API_KEY`, `OPENAI_DEFAULT_MODEL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_DEFAULT_MODEL`
- `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_BASE_URL`,
  `OPENAI_COMPATIBLE_DEFAULT_MODEL`

Generate content:

```bash
curl -X POST https://your-backend.example.com/api/v1/agent/ai/generate \
  -H "Authorization: Bearer $SHITPOSTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a launch post for our new scheduling API.",
    "platforms": ["twitter", "linkedin"],
    "tone": "confident and useful",
    "maxCandidates": 2
  }'
```

Generated content is returned but not published automatically. Send the selected
candidate to `POST /api/v1/agent/posts` to schedule or publish it.

## Error format

Errors use FastAPI's standard JSON response:

```json
{
  "detail": "Invalid API key"
}
```

