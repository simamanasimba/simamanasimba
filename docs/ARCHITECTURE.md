# Architecture

```
        Next.js web (apps/web)
                 │  fetch, credentials: include
                 ▼
        NestJS API (apps/api)
   ┌─────────┬────────┬─────────┬──────────────┐
   │ Members │ Events │ Attend- │ Digital       │
   │ Engine  │ Engine │ ance    │ Intelligence  │
   └─────────┴────────┴─────────┴──────────────┘
                 │
        PostgreSQL (Prisma)  ◄────────┐
                 │                     │
                 ▼                     │
   BullMQ + Redis (apps/worker) ───────┘ (via internal HTTP endpoints,
   scheduled monitoring runs, social      shared secret header)
   metric syncs)
```

## Tenant isolation

Every organization-scoped table has an `organization_id` column. Every org-scoped
controller in `apps/api` is guarded by `OrgMembershipGuard` (resolves the
`:organizationId` route param to the caller's membership, 403s otherwise) and
`RolesGuard` (`@Roles(...)` metadata). Services must always filter queries by
`req.orgMember.organizationId` — never a client-supplied body/query value — so
organization A can never read or write organization B's data. See
`docs/SECURITY.md` for the isolation test plan.

## Auth

Session-cookie based, not JWT: on login, a random opaque token is generated,
SHA-256 hashed, and stored in the `sessions` table; the raw token is set as an
httpOnly, sameSite=lax cookie. This makes sessions trivially revocable (delete/
expire the row) without needing a blocklist. Passwords are hashed with bcrypt
(12 rounds). See `packages/security`.

## Search abstraction

`packages/search` defines a `SearchProvider` interface with two
implementations: `PostgresSearchProvider` (tsvector full-text search against a
`search_documents` table — the default, zero-extra-infra option) and
`OpenSearchSearchProvider` (used automatically when `OPENSEARCH_URL` is set).
`apps/api`'s `SearchIndexService` picks one at startup and is the only thing
callers depend on.

## AI abstraction

`packages/ai` defines an `AiProvider` interface. `NoopAiProvider` (the
default) returns `UNKNOWN`/0-confidence results rather than fabricating
sentiment or topic labels. `AnthropicAiProvider` activates when
`AI_PROVIDER=anthropic` and `AI_API_KEY` are set. Every AI result stored in the
`ai_analyses` table carries `model`/`confidence` so the UI never presents
inference as fact.

## Digital intelligence pipeline

`MonitoringService.runRule` (apps/api) is the core pipeline, callable both from
an admin "Run discovery" button and from the worker's scheduled job:

1. `DiscoveryEngine` (packages/connectors) fans a query out across configured
   providers (NewsAPI, Bing Web Search) and reports which ones were skipped
   for missing credentials — it never fabricates results.
2. Each result is deduplicated via a SHA-256 fingerprint of its URL
   (`dedupeKey`, unique per organization).
3. Entity matching is a substring check against the organization's name +
   configured aliases (`organization_aliases`); non-matching items are
   dropped as noise rather than stored.
4. Matched items go through `AiProvider` for sentiment + topic classification
   and are stored as `Mention` + `AiAnalysis` rows with full provenance
   (`source_type`, `source_provider`, `source_url`, `verification_status`).
5. Negative-sentiment mentions above a confidence threshold raise an `Alert`.

## Social connectors

`packages/connectors`'s `getSocialConnector(platform)` returns a real
`YoutubeConnector` (YouTube Data API v3, works with just an API key) for
`YOUTUBE`, and an honest `UnsupportedSocialConnector` for every other platform
— each citing the exact OAuth/App-Review requirement from
`PLATFORM_CAPABILITIES` (also seeded into the `platform_capabilities` table).
See `docs/CONNECTORS.md`.

## Attendance & offline sync

The public attendance flow (`/api/v1/public/attendance/...`, no session
required — gated by a per-event opaque QR token instead) never exposes the
member database; it only ever looks up one membership number at a time. The
`AttendanceRecord` table has a unique constraint on `(event_id, member_id)` —
duplicate check-ins are rejected at the database level, not just in
application code, so a race between two devices scanning the same person
cannot create two records. Offline support lives entirely client-side (see
`apps/web/src/lib/offlineQueue.ts`): check-ins made while `navigator.onLine`
is false are queued in `localStorage` and flushed to
`/api/v1/public/attendance/events/:id/sync` when connectivity returns.
