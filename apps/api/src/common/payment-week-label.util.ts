import type { PrismaService } from "../prisma/prisma.service";

/** Which week/folder a payment is actually for (e.g. "Week 3") — the label shown in every
 * payment-history table so two payments for the same real week don't sit next to each other
 * looking unremarkable. Takes just the payment ids (not a Prisma `include`) so any service that
 * already has its own `payment.findMany` can call this afterward without changing that query's
 * shape — used by PaymentsService.list() and each beneficiary profile service
 * (media-hosts/influencers/members) that returns its own `payments` array. */
export async function resolveWeekLabels(prisma: PrismaService, paymentIds: string[]): Promise<Map<string, string>> {
  if (paymentIds.length === 0) return new Map();

  const evaluations = await prisma.postingAgreementEvaluation.findMany({
    where: { paymentId: { in: paymentIds } },
    select: { paymentId: true, weekNumber: true, weekDefinitionId: true, folderId: true },
  });
  if (evaluations.length === 0) return new Map();

  const weekDefIds = Array.from(new Set(evaluations.map((e) => e.weekDefinitionId).filter((v): v is string => Boolean(v))));
  const folderIds = Array.from(new Set(evaluations.map((e) => e.folderId).filter((v): v is string => Boolean(v))));
  const [weekDefs, folders]: [Array<{ id: string; name: string }>, Array<{ id: string; name: string }>] = await Promise.all([
    weekDefIds.length ? prisma.postingWeekDefinition.findMany({ where: { id: { in: weekDefIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    folderIds.length ? prisma.influencer2Folder.findMany({ where: { id: { in: folderIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const weekDefName = new Map<string, string>(weekDefs.map((w) => [w.id, w.name]));
  const folderName = new Map<string, string>(folders.map((f) => [f.id, f.name]));

  const result = new Map<string, string>();
  for (const e of evaluations) {
    if (!e.paymentId) continue;
    const label = e.weekNumber != null ? `Week ${e.weekNumber}` : e.weekDefinitionId ? weekDefName.get(e.weekDefinitionId) : e.folderId ? folderName.get(e.folderId) : undefined;
    if (label) result.set(e.paymentId, label);
  }
  return result;
}
