# Digital intelligence connectors — what's real today

The platform never fabricates social metrics, mentions, or news. Every
connector below either genuinely calls the named API or honestly reports that
it can't yet.

| Source | Status | Needs |
|---|---|---|
| RSS/Atom feeds | **Live** | Nothing — no API key required |
| NewsAPI (news search) | **Live** | `NEWS_API_KEY` |
| Bing Web Search | **Live** | `SEARCH_API_KEY` |
| YouTube (channel stats, recent videos) | **Live** | A YouTube Data API v3 key (Google Cloud Console → enable "YouTube Data API v3" → create an API key). No OAuth app review needed — this is the only social platform that works without one. |
| Instagram / Meta Graph API insights | Pending | Instagram Business account linked to a Facebook Page + a Meta app in Live mode with `instagram_manage_insights`, approved via App Review |
| Facebook Page insights | Pending | Facebook Page access token + `pages_read_engagement`, approved via App Review |
| LinkedIn organization statistics | Pending | LinkedIn Marketing Developer Platform partnership approval |
| X (Twitter) user metrics | Pending | Paid X API tier (Basic or higher) |
| Threads insights | Pending | Threads API app in Live mode, App Review |
| TikTok account metrics | Pending | Audited TikTok Developer app |

The exact documentation URL and access requirement for each capability is
hand-maintained in `packages/connectors/src/social/capability-registry.ts`
and seeded into the `platform_capabilities` table — query
`GET /api/v1/platform-capabilities` to see it live, including
`last_verified_at` so stale entries can be caught.

## Adding a new connector

1. Verify the platform's *current* official API docs — endpoint, required
   scopes, rate limits, whether OAuth app review is needed.
2. Add an entry to `PLATFORM_CAPABILITIES` with `status` set honestly
   (`SUPPORTED`, `PARTIAL`, `REQUIRES_APPROVAL`, or `UNSUPPORTED`).
3. Implement a `SocialConnector` (see `youtube-connector.ts` for the pattern)
   that returns `{ status: "UNSUPPORTED" }` for any capability not actually
   implemented yet — never return synthesized numbers.
4. Wire it into `getSocialConnector()` in `packages/connectors/src/index.ts`.
