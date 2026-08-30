import { Injectable, NotFoundException } from "@nestjs/common";
import type { Expense, ExpenseCategory } from "@event-intel/database";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

/** quantity/unitCost/totalCost are Prisma Decimal — serialize to JSON strings unless converted,
 * which would silently break any frontend sum/arithmetic over them. */
function toNumeric(e: Expense) {
  return { ...e, quantity: Number(e.quantity), unitCost: Number(e.unitCost), totalCost: Number(e.totalCost) };
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, category?: ExpenseCategory) {
    const rows = await this.prisma.expense.findMany({ where: { organizationId, category }, orderBy: { dateIssued: "desc" } });
    return rows.map(toNumeric);
  }

  async create(organizationId: string, dto: CreateExpenseDto, createdByUserId: string) {
    const totalCost = dto.quantity * dto.unitCost;
    const row = await this.prisma.expense.create({
      data: {
        organizationId,
        category: dto.category,
        item: dto.item,
        purpose: dto.purpose,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        totalCost,
        dateIssued: new Date(dto.dateIssued),
        concernedParty: dto.concernedParty,
        notes: dto.notes,
        createdByUserId,
      },
    });
    return toNumeric(row);
  }

  private async ensure(organizationId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, organizationId } });
    if (!expense) throw new NotFoundException("Expense not found");
    return expense;
  }

  async update(organizationId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await this.ensure(organizationId, id);
    const quantity = dto.quantity ?? Number(existing.quantity);
    const unitCost = dto.unitCost ?? Number(existing.unitCost);
    const row = await this.prisma.expense.update({
      where: { id },
      data: {
        category: dto.category,
        item: dto.item,
        purpose: dto.purpose,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        totalCost: quantity * unitCost,
        dateIssued: dto.dateIssued ? new Date(dto.dateIssued) : undefined,
        concernedParty: dto.concernedParty,
        notes: dto.notes,
      },
    });
    return toNumeric(row);
  }

  async delete(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    await this.prisma.expense.delete({ where: { id } });
    return { success: true };
  }

  /** Grand totals per category — used by the Finance overview (stat cards, no per-row detail). */
  async totalsByCategory(organizationId: string): Promise<Record<ExpenseCategory, number>> {
    const rows = await this.prisma.expense.groupBy({ by: ["category"], where: { organizationId }, _sum: { totalCost: true } });
    const totals: Record<string, number> = { OPERATIONAL: 0, ADMINISTRATIVE: 0 };
    for (const row of rows) totals[row.category] = Number(row._sum.totalCost ?? 0);
    return totals as Record<ExpenseCategory, number>;
  }
}
