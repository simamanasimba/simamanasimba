const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();
const OUT_DIR = process.argv[2] || ".";

async function main() {
  const tables = await prisma.$queryRawUnsafe("SHOW TABLES");
  const tableNames = tables.map((row) => Object.values(row)[0]);
  console.log(`Found ${tableNames.length} tables`);

  const dump = {};
  for (const name of tableNames) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${name}\``);
    dump[name] = rows;
    console.log(`  ${name}: ${rows.length} rows`);
  }

  const outPath = path.join(OUT_DIR, `emergency-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(dump, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
  console.log(`Written to ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
