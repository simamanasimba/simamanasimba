// One-time boot-time guard: reassigns/removes any role values that predate the
// RoleKey enum trim (EVENT_MANAGER, ATTENDANCE_OFFICER, MEMBERSHIP_OFFICER,
// DIGITAL_INTELLIGENCE_ANALYST, REPORT_VIEWER) so the subsequent `prisma db push`
// doesn't fail with "Data truncated for column 'role'" against rows the new,
// narrower enum can no longer represent. Uses $executeRawUnsafe, which writes
// plain SQL without decoding through the (already-regenerated) typed enum, so
// it works even while the DB still has the old values. Safe to run every boot:
// once no legacy values remain, both statements affect zero rows.
const { PrismaClient, RoleKey } = require("@prisma/client");

// Derived from the generated client instead of a hand-maintained list — that list silently fell
// out of sync with the schema once before (GUEST_USER was added to RoleKey but never added here,
// so this script spent some time quietly reassigning every guest account to STANDARD_USER on
// every single boot, indistinguishable from "data going missing"). Reading it straight from
// RoleKey means it can never drift again: whatever the schema currently defines as valid IS what
// this treats as valid, automatically.
const VALID_ROLES = Object.values(RoleKey);
const inList = VALID_ROLES.map((r) => `'${r}'`).join(",");

async function main() {
  const prisma = new PrismaClient();
  try {
    const reassigned = await prisma.$executeRawUnsafe(
      `UPDATE organization_members SET role='STANDARD_USER' WHERE role NOT IN (${inList})`,
    );
    const removed = await prisma.$executeRawUnsafe(
      `DELETE FROM org_role_permissions WHERE role NOT IN (${inList})`,
    );
    console.log(`fix-legacy-roles: reassigned ${reassigned} organization_members row(s), removed ${removed} org_role_permissions row(s)`);
  } catch (err) {
    console.error("fix-legacy-roles: skipped (non-fatal):", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
