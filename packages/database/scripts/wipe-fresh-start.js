// One-time, manual, opt-in script — wipes Members/Events/Influencers/Media/RegionTargets (and
// everything that only exists to describe them: payments, campaigns, engagements, attendance,
// registrations) for a single organization, for a genuine "fresh start." Deliberately does NOT
// touch: Organization, User, OrganizationMember (login accounts stay exactly as they are),
// Expense, OrgRolePermission, CustomFieldDefinition, or any digital-intelligence/monitoring data
// (Mention/Alert/NewsArticle/etc — untouched since the client never asked for those and they're
// unrelated to "meeting/member/influencer/target/media").
//
// The list below is short because most of the schema already cascades: deleting a MediaCampaign
// auto-removes its TrackerSession/TrackerEntry/TrackerMetric/TrackerReport/MediaActivation/
// CampaignMediaHost/CampaignInfluencer rows; deleting an Influencer2Campaign auto-removes its
// platforms+metric values; deleting a MediaEngagement auto-removes its reach logs; deleting an
// Event auto-removes its EventRegistration/AttendanceRecord/AttendanceToken/AttendanceSession
// rows; deleting a Member auto-removes its MembershipHistory (verified against schema.prisma
// before writing this, not assumed). Only two tables have a Restrict (not Cascade) foreign key
// into something being deleted here, so only those two need an explicit delete first: Payment
// (-> MediaHost/Influencer) and AttendanceDevice/MetricSnapshot (-> Event).
//
// Never wired into the Dockerfile CMD — run manually only, e.g.:
//   railway run --service simba-fans-api node packages/database/scripts/wipe-fresh-start.js <organizationId>
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const organizationId = process.argv[2];
  if (!organizationId) {
    console.error("Usage: node wipe-fresh-start.js <organizationId>");
    process.exit(1);
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!org) {
    console.error(`No organization found with id ${organizationId}`);
    process.exit(1);
  }

  const counts = {
    payments: await prisma.payment.count({ where: { organizationId } }),
    influencer2Campaigns: await prisma.influencer2Campaign.count({ where: { organizationId } }),
    mediaEngagements: await prisma.mediaEngagement.count({ where: { organizationId } }),
    mediaCampaigns: await prisma.mediaCampaign.count({ where: { organizationId } }),
    mediaHosts: await prisma.mediaHost.count({ where: { organizationId } }),
    mediaOutlets: await prisma.mediaOutlet.count({ where: { organizationId } }),
    influencers: await prisma.influencer.count({ where: { organizationId } }),
    events: await prisma.event.count({ where: { organizationId } }),
    members: await prisma.member.count({ where: { organizationId } }),
    regionTargets: await prisma.regionTarget.count({ where: { organizationId } }),
  };

  console.log(`About to wipe operational data for org "${org.name}" (${org.id}):`);
  console.log(counts);

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { organizationId } }),
    prisma.influencer2Campaign.deleteMany({ where: { organizationId } }),
    prisma.mediaEngagement.deleteMany({ where: { organizationId } }),
    prisma.mediaCampaign.deleteMany({ where: { organizationId } }),
    prisma.mediaHost.deleteMany({ where: { organizationId } }),
    prisma.mediaOutlet.deleteMany({ where: { organizationId } }),
    prisma.influencer.deleteMany({ where: { organizationId } }),
    prisma.metricSnapshot.deleteMany({ where: { organizationId } }),
    prisma.attendanceDevice.deleteMany({ where: { organizationId } }),
    prisma.event.deleteMany({ where: { organizationId } }),
    prisma.member.deleteMany({ where: { organizationId } }),
    prisma.regionTarget.deleteMany({ where: { organizationId } }),
  ]);

  const after = {
    payments: await prisma.payment.count({ where: { organizationId } }),
    mediaHosts: await prisma.mediaHost.count({ where: { organizationId } }),
    influencers: await prisma.influencer.count({ where: { organizationId } }),
    events: await prisma.event.count({ where: { organizationId } }),
    members: await prisma.member.count({ where: { organizationId } }),
    regionTargets: await prisma.regionTarget.count({ where: { organizationId } }),
    usersUntouched: await prisma.organizationMember.count({ where: { organizationId } }),
  };
  console.log("Done. Counts after wipe:", after);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("WIPE_FAILED:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
