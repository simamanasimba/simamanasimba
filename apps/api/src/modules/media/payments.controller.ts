import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { PaymentBeneficiaryType, PaymentStatus } from "@event-intel/database";
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { BulkCreatePaymentDto } from "./dto/bulk-create-payment.dto";
import { MarkPaidDto } from "./dto/mark-paid.dto";
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
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  @RequiresArea("finance")
  list(
    @Param("organizationId") organizationId: string,
    @Query("campaignId") campaignId?: string,
    @Query("beneficiaryType") beneficiaryType?: PaymentBeneficiaryType,
    @Query("mediaHostId") mediaHostId?: string,
    @Query("influencerId") influencerId?: string,
    @Query("status") status?: PaymentStatus,
    @Query("method") method?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
  ) {
    return this.payments.list(organizationId, { campaignId, beneficiaryType, mediaHostId, influencerId, status, method, dateFrom, dateTo });
  }

  @Get("finance-dashboard")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  @RequiresArea("finance")
  getFinanceDashboard(@Param("organizationId") organizationId: string) {
    return this.payments.getFinanceDashboard(organizationId);
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
