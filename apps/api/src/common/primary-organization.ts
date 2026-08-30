import type { PrismaService } from "../prisma/prisma.service";

/**
 * Resolves the single organization every unauthenticated /public/* endpoint
 * serves. Explicit via PRIMARY_ORGANIZATION_ID when multiple orgs exist in
 * the database (stray/duplicate signups) — falls back to the oldest org so
 * a fresh deployment with exactly one org keeps working with no config.
 */
export async function resolvePrimaryOrganizationId(prisma: PrismaService): Promise<string | null> {
  const configured = process.env.PRIMARY_ORGANIZATION_ID;
  if (configured) return configured;
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return org?.id ?? null;
}
