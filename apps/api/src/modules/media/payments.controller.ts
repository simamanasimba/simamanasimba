import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { PaymentBeneficiaryType, PaymentStatus } from "@event-intel/database";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { BulkCreatePaymentDto } from "./dto/bulk-create-payment.dto";
import { MarkPaidDto } from "./dto/mark-paid.dto";
import { EditPaymentDto } from "./dto/edit-payment.dto";
import { UndoPaymentDto } from "./dto/undo-payment.dto";
import { RedoPaymentDto } from "./dto/redo-payment.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { StorageService, MAX_UPLOAD_BYTES, sanitizeExtension } from "../storage/storage.service";

@Controller("api/v1/organizations/:organizationId/payments")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("finance")
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(
    @Param("organizationId") organizationId: string,
    @Query("campaignId") campaignId?: string,
    @Query("beneficiaryType") beneficiaryType?: PaymentBeneficiaryType,
    @Query("mediaHostId") mediaHostId?: string,
    @Query("influencerId") influencerId?: string,
    @Query("memberId") memberId?: string,
    @Query("status") status?: PaymentStatus,
    @Query("method") method?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.payments.list(organizationId, { campaignId, beneficiaryType, mediaHostId, influencerId, memberId, status, method, dateFrom, dateTo });
  }

  @Get("finance-dashboard")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  @RequiresArea("finance")
  getFinanceDashboard(@Param("organizationId") organizationId: string) {
    return this.payments.getFinanceDashboard(organizationId);
  }

  /** Finance's on-demand review list: every payment recorded despite a missed posting-agreement
   * target — see Payment.isConditional. Registered before the ":paymentId" routes below so
   * "conditional" is never mistaken for one. */
  @Get("conditional")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  @RequiresArea("finance")
  listConditional(@Param("organizationId") organizationId: string) {
    return this.payments.listConditionalPayments(organizationId);
  }

  /** Reconciliation: every real payment for one beneficiary that isn't accounted for by any week/
   * campaign evaluation — see PaymentsService.listUnlinked for what this catches and why. Super
   * Admin only, registered before the ":paymentId" routes for the same reason as "conditional". */
  @Get("unlinked")
  @Roles("ORG_SUPER_ADMIN")
  listUnlinked(@Param("organizationId") organizationId: string, @Query("mediaHostId") mediaHostId?: string, @Query("influencerId") influencerId?: string) {
    return this.payments.listUnlinked(organizationId, { mediaHostId, influencerId });
  }

  @Post()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreatePaymentDto, @CurrentUser() user: RequestUser) {
    const payment = await this.payments.create(organizationId, dto, user.id);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "payment.created",
      entityType: "payment",
      entityId: payment.id,
      metadata: { amount: Number(payment.amount), beneficiaryType: payment.beneficiaryType },
    });
    return payment;
  }

  @Post(":paymentId/attachment")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadAttachment(
    @Param("organizationId") organizationId: string,
    @Param("paymentId") paymentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException("No file uploaded — expected a file under field name 'file'");
    const ext = sanitizeExtension(file.originalname, "bin");
    const url = await this.storage.upload(`payments/${organizationId}/${paymentId}.${ext}`, file.buffer, file.mimetype);
    const payment = await this.payments.setAttachment(organizationId, paymentId, `${url}?v=${Date.now()}`);
    await this.audit.record({ organizationId, userId: user.id, action: "payment.attachment_uploaded", entityType: "payment", entityId: paymentId });
    return payment;
  }

  @Patch(":paymentId/approve")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("payment-approval")
  async approve(@Param("organizationId") organizationId: string, @Param("paymentId") paymentId: string, @CurrentUser() user: RequestUser) {
    const payment = await this.payments.approve(organizationId, paymentId, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "payment.approved", entityType: "payment", entityId: paymentId });
    return payment;
  }

  @Patch(":paymentId/reject")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN")
  @RequiresArea("payment-approval")
  async reject(@Param("organizationId") organizationId: string, @Param("paymentId") paymentId: string, @CurrentUser() user: RequestUser) {
    const payment = await this.payments.reject(organizationId, paymentId, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "payment.rejected", entityType: "payment", entityId: paymentId });
    return payment;
  }

  @Patch(":paymentId/mark-paid")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  @RequiresArea("finance")
  async markPaid(
    @Param("organizationId") organizationId: string,
    @Param("paymentId") paymentId: string,
    @Body() dto: MarkPaidDto,
    @CurrentUser() user: RequestUser,
  ) {
    const payment = await this.payments.markPaid(organizationId, paymentId, dto.method, dto.referenceNumber, dto.paidAmount, dto.varianceNote);
    await this.audit.record({ organizationId, userId: user.id, action: "payment.marked_paid", entityType: "payment", entityId: paymentId });
    return payment;
  }

  /** Sensitive action — Super Admin only. Corrects an existing payment record after the fact
   * (amount, date, method, reference, bank/mobile details) with a mandatory reason, flagged in the
   * audit log for review (see AuditLogsController.listSensitive). */
  @Patch(":paymentId/edit")
  @Roles("ORG_SUPER_ADMIN")
  async edit(
    @Param("organizationId") organizationId: string,
    @Param("paymentId") paymentId: string,
    @Body() dto: EditPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    const { before, after, beneficiaryName } = await this.payments.editPayment(organizationId, paymentId, dto);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "payment.edited",
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        reason: dto.reason,
        before,
        after,
        beneficiaryName,
        amount: after.amount,
        paidAmount: after.paidAmount,
        currency: after.currency,
        description: after.description,
      },
    });
    return after;
  }

  /** Sensitive action — Super Admin only. Reverses a payment (including an already-PAID one) to
   * CANCELLED, with a mandatory reason, flagged in the audit log for review. Deliberately leaves
   * the week/campaign it was linked to exactly as-is — see PaymentsService.undoPayment's own doc
   * comment for why that's what keeps a cancelled payment out of the normal pay queue. */
  @Post(":paymentId/undo")
  @Roles("ORG_SUPER_ADMIN")
  async undo(
    @Param("organizationId") organizationId: string,
    @Param("paymentId") paymentId: string,
    @Body() dto: UndoPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    const { payment, previousStatus, beneficiaryName } = await this.payments.undoPayment(organizationId, paymentId);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "payment.undone",
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        reason: dto.reason,
        previousStatus,
        beneficiaryName,
        amount: payment.amount,
        paidAmount: payment.paidAmount,
        currency: payment.currency,
        description: payment.description,
      },
    });
    return payment;
  }

  /** Sensitive action — Super Admin only. Reverses one specific undoPayment() call (identified by
   * that undo's own audit log entry), restoring the payment's status and re-linking whatever it
   * had flipped to "unpaid" — see PaymentsService.redoUndoPayment for the exact rules. Always
   * requires a stated reason, flagged in the audit log like every other sensitive action. */
  @Post(":paymentId/redo")
  @Roles("ORG_SUPER_ADMIN")
  async redo(
    @Param("organizationId") organizationId: string,
    @Param("paymentId") paymentId: string,
    @Body() dto: RedoPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    const { payment, beneficiaryName } = await this.payments.redoUndoPayment(organizationId, paymentId, dto.auditLogId);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "payment.redone",
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        reason: dto.reason,
        restoredStatus: payment.status,
        undoAuditLogId: dto.auditLogId,
        beneficiaryName,
        amount: payment.amount,
        paidAmount: payment.paidAmount,
        currency: payment.currency,
        description: payment.description,
      },
    });
    return payment;
  }

  @Post("bulk")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  async createBulk(@Param("organizationId") organizationId: string, @Body() dto: BulkCreatePaymentDto, @CurrentUser() user: RequestUser) {
    const result = await this.payments.createBulk(organizationId, dto, user.id);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "payment.bulk_created",
      entityType: "payment",
      entityId: dto.beneficiaryType,
      metadata: { count: result.created, beneficiaryType: dto.beneficiaryType },
    });
    return result;
  }
}
