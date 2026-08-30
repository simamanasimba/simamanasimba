const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("@event-intel/security");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(process.env.NEW_ADMIN_PASSWORD);

  const org = await prisma.organization.upsert({
    where: { slug: "simamanasimba" },
    create: { name: "Simama Nasimba", slug: "simamanasimba", isDemo: false, settings: {} },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@simamanasima.com" },
    create: {
      email: "admin@simamanasima.com",
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
