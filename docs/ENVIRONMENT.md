# Environment variables

Full list with descriptions: [`.env.example`](../.env.example) (read by
`apps/api` and `apps/worker`) and
[`apps/web/.env.local.example`](../apps/web/.env.local.example) (read by the
Next.js app — only `NEXT_PUBLIC_API_URL` today, since the web app has no
server-side secrets of its own).

## Required to boot at all
`DATABASE_URL`, `ENCRYPTION_KEY` (32+ chars).

## Required for specific features (the app runs and clearly reports the gap without them)
| Variable | Feature unlocked |
|---|---|
| `REDIS_URL` | `apps/worker` background jobs |
| `OPENSEARCH_URL` | Production-grade search (else Postgres full-text fallback) |
| `S3_ENDPOINT`/`S3_BUCKET`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` | Object storage (else local disk under `apps/api/storage`) |
| `SMTP_HOST` + friends | Real email delivery (else emails are logged, not sent) |
| `AI_PROVIDER=anthropic` + `AI_API_KEY` | Sentiment/topic/relevance analysis (else `NoopAiProvider`) |
| `NEWS_API_KEY` | News discovery |
| `SEARCH_API_KEY` | Web search discovery (Bing) |
| `YOUTUBE_API_KEY` | YouTube channel/video metrics |
| `META_*`, `LINKEDIN_*`, `GOOGLE_*`, `X_*`, `THREADS_*`, `TIKTOK_*` | Reserved for OAuth connectors pending app review — see `docs/CONNECTORS.md` |
| `INTERNAL_API_KEY` + `API_INTERNAL_URL` | Worker → API scheduled job calls |

Never commit `.env` or `apps/web/.env.local` — both are gitignored.
