# Event, Membership, Attendance & Digital Intelligence Platform

A standalone platform combining membership management, event registration, QR-based
attendance, live attendance dashboards, membership/event analytics, and digital
intelligence (social monitoring, news/web mentions, AI-assisted sentiment & topic
analysis, event digital impact). Fully independent — no dependency on any CRM/ERP.

See [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) for exactly what
is real and working today versus what remains to be built.

## Stack

- **Web**: Next.js 14 (App Router) + React + TypeScript + Tailwind + TanStack Query + Recharts
- **API**: NestJS + TypeScript, session-cookie auth, REST
- **Database**: MySQL/MariaDB + Prisma (originally spec'd as PostgreSQL — switched because this environment couldn't get a Postgres instance installed; see `docs/IMPLEMENTATION_STATUS.md`)
- **Search**: Postgres full-text (dev fallback) / OpenSearch (production) — see `packages/search`
- **Queue**: Redis + BullMQ (`apps/worker`)
- **AI**: vendor-neutral abstraction (`packages/ai`) — Anthropic today, Noop when unconfigured
- **Digital intelligence connectors**: `packages/connectors` — RSS, NewsAPI, Bing Web Search, YouTube Data API v3 (all real); Instagram/Meta/LinkedIn/X/Facebook/Threads/TikTok are honest stubs pending OAuth app review (see `docs/CONNECTORS.md`)

## Monorepo layout

```
apps/
  web/      Next.js frontend
  api/      NestJS REST API
  worker/   BullMQ background jobs (scheduled monitoring runs, social metric syncs)
packages/
  database/    Prisma schema + client + membership-number generator
  types/       Shared TypeScript types
  search/      Search provider abstraction (MySQL/Postgres LIKE fallback / OpenSearch)
  ai/          AI provider abstraction (Anthropic / Noop)
  connectors/  Digital intelligence discovery + social connectors
  security/    Password hashing, opaque token generation
  logger/      Structured logging (pino)
  config/      Env var validation (zod)
infrastructure/
  docker/      docker-compose.yml for local Postgres/Redis/OpenSearch/MinIO
docs/
```

## Quick start

1. **Database**: any MySQL/MariaDB 10.4+ server works (this project currently runs against XAMPP's bundled MariaDB — see `docs/IMPLEMENTATION_STATUS.md` for why it's MySQL and not the originally-planned PostgreSQL). Create a database named `event_intel`.
2. **Install**: `pnpm install`
3. **Environment**: copy `.env.example` to `.env`, set `DATABASE_URL` (e.g. `mysql://root:@localhost:3306/event_intel`).
4. **Schema**: `pnpm --filter @event-intel/database run generate` then `npx prisma db push` (run from `packages/database`, with `DATABASE_URL` set) to create tables, then `pnpm db:seed` (seeds an isolated `[DEMO]`-labelled organization).
5. **Run**: `pnpm --filter @event-intel/api run build && node apps/api/dist/main.js` for the API, `pnpm --filter @event-intel/web run dev` for the web app (`pnpm dev`'s `nest start --watch` has a known dist/incremental-cache issue on Windows — see `docs/IMPLEMENTATION_STATUS.md`).
6. Log in with the seeded demo admin: `admin@demo.local` / `DemoPass123!`.
7. Optional: `docker compose -f infrastructure/docker/docker-compose.yml up -d` still works if you have Docker, for Redis/OpenSearch/MinIO (none of which are required to run the core app).

Full walkthrough: [`docs/SETUP.md`](docs/SETUP.md).

## Key documents

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, tenant isolation, module boundaries
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — schema overview
- [`docs/API.md`](docs/API.md) — REST endpoint reference
- [`docs/SECURITY.md`](docs/SECURITY.md) — auth, RBAC, tenant isolation, secrets handling
- [`docs/CONNECTORS.md`](docs/CONNECTORS.md) — what's genuinely live vs. pending OAuth approval per platform
- [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) — honest phase-by-phase status
