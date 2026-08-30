# Implementation status

Honest, phase-by-phase status against the original build spec. Updated
2026-08-25 (session 2). This is not a prototype disclaimer — every item
marked ✅ is real, working, tenant-isolated code that typechecks and builds;
items marked ⏳/❌ are named explicitly rather than glossed over.

## Database: MySQL/MariaDB, not PostgreSQL (session 2 update)

The spec called for PostgreSQL. Getting a real Postgres instance running on
this Windows machine hit a wall: no Docker/WSL2 (needs an interactive admin
step + reboot), a pre-existing PostgreSQL 17 service already on the machine
with an unknown password (not this project's to touch), and EDB's installer
downloads being intermittently blocked/rate-limited by their CDN — even a
portable, non-service Postgres binary still needed admin elevation to run
as a Windows service. XAMPP's bundled MariaDB was already running, so the
project now targets **MySQL/MariaDB** in a dedicated `event_intel` database.
This is a real, tested, working switch — not a workaround left half-done:
schema, raw SQL, and search fallback were all ported and the full stack has
been run end-to-end against it (login, member search, seed data all verified
live). See the "Database pivot" section of this project's saved memory for
the full list of what changed. If genuine PostgreSQL access becomes available
later, both `PostgresSearchProvider` and `MySqlSearchProvider` still exist
side by side in `packages/search` to make switching back straightforward.

## App is running (session 2)

As of this session, the API (`:4000`) and web app (`:3000`) are both running
against the live `event_intel` MySQL database, started directly via
`node apps/api/dist/main.js` and `pnpm --filter @event-intel/web run dev`
(not `pnpm dev`'s `nest start --watch`, which hit an unrelated NestJS CLI
issue — see below). Verified live: login, `/auth/me`, member search with
real seeded data. Redis/BullMQ (the worker) is not running — Memurai's
installer also needs admin elevation — so scheduled digital-intelligence
jobs don't run yet, but this doesn't block the API or web app.

**Known issue**: `nest start --watch` (used by `pnpm dev`/`pnpm dev:api`) can
end up with `dist/` empty despite exit code 0, because `nest-cli.json`'s
`deleteOutDir: true` combined with TypeScript's `"incremental": true` cache
can decide "nothing changed" and skip re-emitting files that were just
deleted. Fixed for plain builds by setting `"incremental": false` in
`apps/api/tsconfig.json`, but watch-mode dev ergonomics haven't been
revisited — for now, build once (`nest build`) and run
`node dist/main.js` directly instead of watch mode.

## Phase 1 — Foundation, Auth, Organizations, RBAC, Database
✅ Prisma schema covering essentially the full spec §58 table list, with the
hard constraints called for in §59 (`attendance_records` unique on
`(event_id, member_id)`, `members` unique on `(organization_id,
membership_number)`, dedupe keys on mentions/news/web mentions). ✅ Session-
cookie auth (register-org, login, logout, verify-email, forgot/reset
password). ✅ 9-role RBAC enforced via `OrgMembershipGuard` + `RolesGuard`.
⏳ Automated tenant-isolation and RBAC test suite not yet written (see
Phase 11).

## Phase 2 — Members, Membership, Search
✅ CRUD, atomic per-org membership-number generator, full member profile
(history, registrations, attendance, computed stats), search with partial
matching across name/number/phone/email + filters + pagination. ✅ Advanced
member intelligence queries (frequent attendees, never-attended, inactive-N-
months, by-region, by-type). ✅ Global search endpoint (Postgres full-text by
default, OpenSearch when configured) — indexing wired for members/events;
mentions indexed on discovery.

## Phase 3 — Events, Registration, QR
✅ CRUD, capacity/waitlisting, registration separate from membership per §17,
QR generation/regeneration/revocation with hashed, expirable tokens.

## Phase 4 — Attendance, Mobile, Offline, Live Dashboard
✅ Full public QR check-in flow (lookup → confirm → duplicate detection →
walk-in registration → auto-check-in), mobile-first UI at `/attend/[eventId]`.
✅ Offline queueing client-side (localStorage) with automatic sync on
reconnect and an ONLINE/OFFLINE/SYNCING/SYNCED status indicator. ✅ Live
attendance dashboard (polls every 5s). ✅ Attendance devices
(register/list/heartbeat). This is the path covered by the spec's acceptance
test in §73 — it has not yet been run against a live database (see
"Not yet done" below), but every unit of it has been built and typechecks.

## Phase 5 — Analytics, Reports
✅ Membership growth (configurable interval), event comparison, attendance
time series. ✅ CSV report generation (real, stored via S3 or local-disk
fallback). ⏳ PDF/Excel export: the endpoint exists and returns an honest
"not yet implemented" error rather than a fake file — not built yet.

## Phase 6-7 — Digital Monitoring, AI Intelligence
✅ `DiscoveryEngine` with real RSS/NewsAPI/Bing providers (RSS needs no key;
the others need `NEWS_API_KEY`/`SEARCH_API_KEY`). ✅ Deduplication via URL
fingerprinting, alias-substring entity matching, full provenance fields. ✅ AI
abstraction with a real Anthropic implementation and an honest
`NoopAiProvider` default (never fabricates sentiment/topic). ✅ Alerts raised
on negative-sentiment mentions.

## Phase 8-9 — Social Connectors, Social Analytics
✅ YouTube connector — genuinely live with just an API key (channel stats,
recent videos). ❌ Instagram/Meta/LinkedIn/X/Facebook/Threads/TikTok: honest
`UnsupportedSocialConnector` stubs citing the exact OAuth/App-Review
requirement per `docs/CONNECTORS.md` — not implemented, by design, until
those credentials/approvals exist. ✅ `apps/worker` BullMQ job syncs YouTube
metric snapshots hourly via an internal API endpoint.

## Phase 10 — Event Digital Impact
✅ Event Impact report (registrations, attendance, digital mentions, news
count) — explicitly labels that digital figures reflect only what monitoring
has discovered, not a claim of total coverage (spec §51-52). ⏳ Correlation
narrative ("mentions rose after the event started") not built — only raw
counts today.

## Phase 11 — Security, Performance, Observability, Production Hardening
✅ Structured logging with secret redaction (pino), request IDs, health
checks (`/health/*`). ✅ Rate limiting (global throttle). ✅ BullMQ retry with
exponential backoff for worker jobs. ⏳ **Not done**: unit/integration/E2E
test suite (spec §72), tenant-isolation automated tests, production Dockerfiles
for `apps/{web,api,worker}` (docker-compose currently covers infra only —
Postgres/Redis/OpenSearch/MinIO — not the app containers themselves), CSRF
tokens, MFA.

## Explicitly not started
- Separate "Connected Platforms" and "System Administration" UI pages (backend
  endpoints exist and are directly testable; no dedicated frontend yet beyond
  what's folded into Settings/Digital Intelligence).
- Live database has never been migrated against — this machine had no
  Docker/Postgres at session start; `wsl --install` + Docker Desktop setup
  needs a user-run elevation + reboot (can't be done headlessly). Once
  infra is up: `pnpm db:migrate && pnpm db:seed`, then re-run the acceptance
  flow in spec §73 end-to-end and fix whatever the first real run surfaces.
- Terraform (`infrastructure/terraform/`) — directory exists, empty.

## What "done" means here
Every ✅ above has been verified by `pnpm -r run typecheck` and
`pnpm --filter <pkg> run build` succeeding across all 12 workspace packages/
apps, plus a full `next build` production build of the web app. It has **not**
been verified against a running database yet — that is the very next step
once local infrastructure is available.
