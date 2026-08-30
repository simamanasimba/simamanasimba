# Data model

Full source of truth: `packages/database/prisma/schema.prisma`. All IDs are
UUIDs, all timestamps UTC. Summary by domain:

**Organizations & RBAC**: `organizations`, `users`, `sessions`,
`email_verification_tokens`, `password_reset_tokens`, `organization_members`
(role + status per user per org).

**Membership**: `membership_number_sequences` (per-org, per-prefix atomic
counter backing e.g. `MDF-000042`), `members`, `membership_history`,
`custom_field_definitions`.

**Events & attendance**: `events`, `event_registrations`, `attendance_records`
(unique on `(event_id, member_id)` — the hard duplicate-prevention
constraint), `attendance_sessions`, `attendance_devices`, `attendance_tokens`
(hashed QR tokens).

**Digital intelligence**: `organization_aliases`, `social_accounts`,
`platform_capabilities`, `monitoring_rules` + `monitoring_queries`, `content`
+ `content_metrics`, `mentions` + `mention_sources`, `news_articles`,
`web_mentions`, `search_results`, `alerts`, `ai_analyses`, `metric_snapshots`.

**Operational**: `sync_jobs`, `webhook_events`, `reports`, `audit_logs`,
`search_documents` (Postgres full-text fallback index).

## Notable constraints

- `members`: unique `(organization_id, membership_number)`.
- `attendance_records`: unique `(event_id, member_id)` — the single most
  important constraint in the schema; enforces "one member, one event, one
  attendance" at the database level regardless of application-layer bugs.
- `mentions` / `news_articles` / `web_mentions`: unique `(organization_id,
  dedupe_key)` — the deduplication mechanism described in spec section 38.
- `organization_members`: unique `(organization_id, user_id)`.

## Migrations

Not yet run against a live database (see `docs/IMPLEMENTATION_STATUS.md`) —
`pnpm db:migrate` will create the initial migration once Postgres is
reachable. One manual follow-up after the first migration: add a GIN index on
`search_documents.tsv` (`Unsupported("tsvector")` fields aren't managed by
Prisma migrate) — see the comment in `packages/search/src/postgres-search-provider.ts`.
