# Setup

## Prerequisites

- Node.js 20+ and pnpm (`npm install -g pnpm`)
- Docker Desktop (with WSL2 backend on Windows)

### If Docker Desktop isn't installed yet (Windows)

1. Open **PowerShell as Administrator** and run: `wsl --install`
2. Reboot when prompted.
3. Launch Docker Desktop and complete its first-run setup (it will use the WSL2 backend automatically).
4. Verify: `docker --version` and `docker compose version` in a normal terminal.

## Bring up infrastructure

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

This starts Postgres (5432), Redis (6379), OpenSearch (9200), and MinIO (9000/9001 console).
Postgres/Redis are required; OpenSearch and MinIO are optional in development — omit
`OPENSEARCH_URL`/`S3_*` from `.env` to use the Postgres full-text search fallback and
local-disk file storage instead.

## Install & configure

```bash
pnpm install
cp .env.example .env   # fill in real secrets; generate ENCRYPTION_KEY with: openssl rand -hex 32
```

## Database

```bash
pnpm db:generate   # generate Prisma client
pnpm db:migrate    # create tables (prompts for a migration name on first run)
pnpm db:seed       # seed an isolated [DEMO] organization
```

## Run

```bash
pnpm dev           # runs web (:3000) and api (:4000) together
pnpm dev:worker    # run the background worker separately (needs Redis)
```

Log in at http://localhost:3000 with `admin@demo.local` / `DemoPass123!` (seeded demo admin).

## Mobile attendance flow

Once an event exists and its QR code has been generated (Event detail page → "Generate QR
code"), open the `checkInUrl` shown there on a phone — that's the actual mobile-first
attendance page (`/attend/[eventId]?token=...`). It works over your LAN if your phone and
dev machine are on the same network and you replace `localhost` with your machine's LAN IP
in `WEB_ORIGIN`/`NEXT_PUBLIC_API_URL`.

## Building for production

```bash
pnpm build   # builds all packages and apps (packages must build before apps — pnpm handles ordering via workspace deps)
```
