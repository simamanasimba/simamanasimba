const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("@event-intel/security");

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@simamanasimba.com";
const OLD_ADMIN_EMAIL = "admin@simamanasima.com";

async function main() {
  const passwordHash = await hashPassword(process.env.NEW_ADMIN_PASSWORD);

  const org = await prisma.organization.upsert({
    where: { slug: "simamanasimba" },
    create: { name: "Simama Nasimba", slug: "simamanasimba", isDemo: false, settings: {} },
    update: {},
  });

  const existingUnderOldEmail = await prisma.user.findUnique({ where: { email: OLD_ADMIN_EMAIL } });
  if (existingUnderOldEmail) {
    await prisma.user.update({
      where: { id: existingUnderOldEmail.id },
      data: { email: ADMIN_EMAIL, passwordHash, status: "ACTIVE", isPlatformOwner: true },
    });
    console.log("Renamed " + OLD_ADMIN_EMAIL + " -> " + ADMIN_EMAIL);
    return;
  }

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      status: "ACTIVE",
      isPlatformOwner: true,
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash, status: "ACTIVE", isPlatformOwner: true },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    create: { organizationId: org.id, userId: admin.id, role: "ORG_SUPER_ADMIN" },
    update: { role: "ORG_SUPER_ADMIN" },
  });

  console.log("OK org=" + org.slug + " admin=" + admin.email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
