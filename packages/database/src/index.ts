import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __eventIntelPrisma: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse a single client across hot reloads in dev to avoid exhausting connections.
export const prisma: PrismaClient = global.__eventIntelPrisma ?? createPrismaClient();

if (process.env.NODE_ENV === "development") {
  global.__eventIntelPrisma = prisma;
}

/**
 * Atomically allocates the next membership number for an organization, e.g. "MDF-000042".
 * Uses a per-organization sequence row updated inside the caller's transaction to avoid
 * duplicate numbers under concurrent registrations.
 */
export async function nextMembershipNumber(
  tx: Pick<PrismaClient, "membershipNumberSequence">,
  organizationId: string,
  prefix: string,
): Promise<string> {
  // create seeds nextValue at 2 (this call allocates 1); update increments and returns the
  // post-increment value. Either way the number allocated by *this* call is `nextValue - 1`.
  const sequence = await tx.membershipNumberSequence.upsert({
    where: { organizationId_prefix: { organizationId, prefix } },
    create: { organizationId, prefix, nextValue: 2, padding: 6 },
    update: { nextValue: { increment: 1 } },
  });
  const allocated = sequence.nextValue - 1;
  return `${prefix}-${String(allocated).padStart(sequence.padding, "0")}`;
}
