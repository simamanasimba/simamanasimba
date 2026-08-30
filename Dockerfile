FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile

ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder"
RUN pnpm --filter @event-intel/database run generate
RUN pnpm --filter "@event-intel/api..." run build

WORKDIR /app
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @event-intel/database exec node scripts/fix-legacy-roles.js; pnpm --filter @event-intel/database exec prisma db push --skip-generate --accept-data-loss --schema=prisma/schema.prisma && cd apps/api && node dist/main.js"]
