import { nextMembershipNumber } from "./index";

/** In-memory stand-in for the `membershipNumberSequence` Prisma delegate. */
function createFakeSequenceTable() {
  const rows = new Map<string, { nextValue: number; padding: number }>();
  return {
    async upsert({ where, create, update }: any) {
      const key = `${where.organizationId_prefix.organizationId}:${where.organizationId_prefix.prefix}`;
      const existing = rows.get(key);
      if (!existing) {
        rows.set(key, { nextValue: create.nextValue, padding: create.padding });
        return rows.get(key)!;
      }
      existing.nextValue += update.nextValue.increment;
      return existing;
    },
  };
}

describe("nextMembershipNumber", () => {
  it("allocates sequential numbers starting at 1", async () => {
    const tx = { membershipNumberSequence: createFakeSequenceTable() } as any;
    const first = await nextMembershipNumber(tx, "org-1", "MDF");
    const second = await nextMembershipNumber(tx, "org-1", "MDF");
    const third = await nextMembershipNumber(tx, "org-1", "MDF");

    expect(first).toBe("MDF-000001");
    expect(second).toBe("MDF-000002");
    expect(third).toBe("MDF-000003");
  });

  it("keeps separate sequences per organization", async () => {
    const tx = { membershipNumberSequence: createFakeSequenceTable() } as any;
    const orgA = await nextMembershipNumber(tx, "org-a", "MDF");
    const orgB = await nextMembershipNumber(tx, "org-b", "MDF");

    expect(orgA).toBe("MDF-000001");
    expect(orgB).toBe("MDF-000001");
  });

  it("keeps separate sequences per prefix within the same organization", async () => {
    const tx = { membershipNumberSequence: createFakeSequenceTable() } as any;
    const staff = await nextMembershipNumber(tx, "org-1", "STF");
    const members = await nextMembershipNumber(tx, "org-1", "MDF");

    expect(staff).toBe("STF-000001");
    expect(members).toBe("MDF-000001");
  });
});
