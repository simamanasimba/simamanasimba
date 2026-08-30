import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@event-intel/security";

const prisma = new PrismaClient();

function generateCampaignId(): string {
  return `CMP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Seeds an isolated demo organization (isDemo: true) so local development
 * has real, navigable data without ever touching a production tenant.
 * Every demo record is clearly labelled — see spec sections 70-71: demo data
 * must never be mistaken for genuinely discovered/collected data.
 */
async function main() {
  console.log("Seeding demo organization…");

  const passwordHash = await hashPassword("DemoPass123!");

  const org = await prisma.organization.upsert({
    where: { slug: "demo-foundation" },
    create: { name: "[DEMO] Demo Foundation", slug: "demo-foundation", isDemo: true, settings: { membershipNumberPrefix: "DEMO" } },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    create: {
      email: "admin@demo.local",
      passwordHash,
      firstName: "Demo",
      lastName: "Admin",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    create: { organizationId: org.id, userId: admin.id, role: "ORG_SUPER_ADMIN" },
    update: {},
  });

  const regions = ["Dar es Salaam", "Arusha", "Mwanza"];
  const members = [];
  for (let i = 1; i <= 30; i++) {
    const seq = await prisma.membershipNumberSequence.upsert({
      where: { organizationId_prefix: { organizationId: org.id, prefix: "DEMO" } },
      create: { organizationId: org.id, prefix: "DEMO", nextValue: 2, padding: 6 },
      update: { nextValue: { increment: 1 } },
    });
    const number = seq.nextValue - 1;
    const member = await prisma.member.upsert({
      where: { organizationId_membershipNumber: { organizationId: org.id, membershipNumber: `DEMO-${String(number).padStart(6, "0")}` } },
      create: {
        organizationId: org.id,
        membershipNumber: `DEMO-${String(number).padStart(6, "0")}`,
        campaignId: generateCampaignId(),
        firstName: `Member${i}`,
        lastName: "Demo",
        region: regions[i % regions.length],
        membershipType: i % 5 === 0 ? "PREMIUM" : "REGULAR",
        registrationDate: new Date(Date.now() - i * 20 * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
    members.push(member);
  }

  const event = await prisma.event.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: org.id,
      createdByUserId: admin.id,
      name: "[DEMO] Community Health Festival",
      description: "Seeded demo event for local development.",
      location: "Demo Community Hall",
      startDatetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endDatetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      status: "OPEN",
      monitoringKeywords: ["Community Health Festival", "#DemoHealthFestival"],
    },
    update: {},
  });

  for (const member of members.slice(0, 20)) {
    await prisma.eventRegistration.upsert({
      where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
      create: { eventId: event.id, memberId: member.id, source: "ADMIN", registrationStatus: "APPROVED" },
      update: {},
    });
  }

  for (const member of members.slice(0, 12)) {
    await prisma.attendanceRecord.upsert({
      where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
      create: { organizationId: org.id, eventId: event.id, memberId: member.id, method: "ADMIN" },
      update: {},
    });
  }

  const rule = await prisma.monitoringRule.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    create: { id: "00000000-0000-0000-0000-000000000002", organizationId: org.id, name: "[DEMO] Organization name", eventId: event.id },
    update: {},
  });
  await prisma.monitoringQuery.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    create: { id: "00000000-0000-0000-0000-000000000003", ruleId: rule.id, queryType: "KEYWORD", value: "Demo Foundation" },
    update: {},
  });

  console.log(`Seeded org ${org.slug} with ${members.length} members, 1 event, admin login: admin@demo.local / DemoPass123!`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
