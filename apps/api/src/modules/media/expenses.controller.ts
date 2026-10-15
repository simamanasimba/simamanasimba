import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { ExpenseCategory } from "@event-intel/database";
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { MAX_UPLOAD_BYTES } from "../storage/storage.service";
import { parseCsv } from "../../common/csv.util";

/** Operational and administrative spending — separate from Payments (which pay influencers/media
 * hosts). Finance-only: same role set as payment write access. */
@Controller("api/v1/organizations/:organizationId/expenses")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("finance")
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Query("category") category?: ExpenseCategory) {
    return this.expenses.list(organizationId, category);
  }

  @Get("totals")
  totals(@Param("organizationId") organizationId: string) {
    return this.expenses.totalsByCategory(organizationId);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async import(
    @Param("organizationId") organizationId: string,
    @Query("category") category: ExpenseCategory,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!category) throw new BadRequestException("category query param is required");
    if (!file) throw new BadRequestException("No file uploaded — expected a CSV file under field name 'file'");
    const rows = parseCsv(file.buffer.toString("utf-8"));
    const result = await this.expenses.importRows(organizationId, category, rows, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "expense.imported", entityType: "expense", metadata: result });
    return result;
  }

  @Post()
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreateExpenseDto, @CurrentUser() user: RequestUser) {
    const expense = await this.expenses.create(organizationId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "expense.created", entityType: "expense", entityId: expense.id });
    return expense;
  }

  @Patch(":expenseId")
  async update(
    @Param("organizationId") organizationId: string,
    @Param("expenseId") expenseId: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: RequestUser,
  ) {
    const expense = await this.expenses.update(organizationId, expenseId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "expense.updated", entityType: "expense", entityId: expenseId });
    return expense;
  }

  @Delete(":expenseId")
  async remove(@Param("organizationId") organizationId: string, @Param("expenseId") expenseId: string, @CurrentUser() user: RequestUser) {
    const result = await this.expenses.delete(organizationId, expenseId);
    await this.audit.record({ organizationId, userId: user.id, action: "expense.deleted", entityType: "expense", entityId: expenseId });
    return result;
  }
}
