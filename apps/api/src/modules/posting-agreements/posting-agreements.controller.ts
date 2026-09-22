import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PostingAgreementsService } from "./posting-agreements.service";
import { CreatePostingAgreementDto } from "./dto/create-posting-agreement.dto";
import { UpdatePostingAgreementDto } from "./dto/update-posting-agreement.dto";
import { MarkAgreementPaidDto } from "./dto/mark-agreement-paid.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";
import { StorageService, MAX_UPLOAD_BYTES, sanitizeExtension } from "../storage/storage.service";

@Controller("api/v1/organizations/:organizationId/posting-agreements")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("finance")
export class PostingAgreementsController {
  constructor(
    private readonly agreements: PostingAgreementsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  list(@Param("organizationId") organizationId: string, @Query("mediaHostId") mediaHostId?: string, @Query("influencerId") influencerId?: string) {
    return this.agreements.list(organizationId, { mediaHostId, influencerId });
  }

  /** Finance's queue: every completed week across every agreement that met its target(s) and
   * hasn't been ticketed yet. Registered before the ":agreementId" routes so it's never mistaken
   * for an agreement id. */
  @Get("ready-for-payment")
  listReadyForPayment(@Param("organizationId") organizationId: string, @CurrentUser() user: RequestUser) {
    return this.agreements.listReadyForPayment(organizationId, user.id);
  }

  @Post()
  async create(@Param("organizationId") organizationId: string, @Body() dto: CreatePostingAgreementDto, @CurrentUser() user: RequestUser) {
    const agreement = await this.agreements.create(organizationId, dto, user.id);
    await this.audit.record({ organizationId, userId: user.id, action: "posting_agreement.created", entityType: "posting_agreement", entityId: agreement.id });
    return agreement;
  }

  @Patch(":agreementId")
  async update(@Param("organizationId") organizationId: string, @Param("agreementId") agreementId: string, @Body() dto: UpdatePostingAgreementDto, @CurrentUser() user: RequestUser) {
    const agreement = await this.agreements.update(organizationId, agreementId, dto);
    await this.audit.record({ organizationId, userId: user.id, action: "posting_agreement.updated", entityType: "posting_agreement", entityId: agreementId });
    return agreement;
  }

  /** Deletes the agreement entirely ("clear agreement") — cascades to its evaluations (a DB-level
   * onDelete: Cascade), but any Payment already created from one of those evaluations is left
   * alone; money already tracked stays tracked even once its originating agreement is gone. */
  @Delete(":agreementId")
  @Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
  async remove(@Param("organizationId") organizationId: string, @Param("agreementId") agreementId: string, @CurrentUser() user: RequestUser) {
    const result = await this.agreements.remove(organizationId, agreementId);
    await this.audit.record({ organizationId, userId: user.id, action: "posting_agreement.deleted", entityType: "posting_agreement", entityId: agreementId });
    return result;
  }

  @Post(":agreementId/attachment")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadAttachment(
    @Param("organizationId") organizationId: string,
    @Param("agreementId") agreementId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException("No file uploaded — expected a file under field name 'file'");
    const ext = sanitizeExtension(file.originalname, "bin");
    const url = await this.storage.upload(`posting-agreements/${organizationId}/${agreementId}.${ext}`, file.buffer, file.mimetype);
    const agreement = await this.agreements.setAttachment(organizationId, agreementId, `${url}?v=${Date.now()}`);
    await this.audit.record({ organizationId, userId: user.id, action: "posting_agreement.attachment_uploaded", entityType: "posting_agreement", entityId: agreementId });
    return agreement;
  }

  @Get(":agreementId/weeks")
  listWeeks(@Param("organizationId") organizationId: string, @Param("agreementId") agreementId: string) {
    return this.agreements.listWeeks(organizationId, agreementId);
  }

  @Post(":agreementId/weeks/:weekNumber/evaluate")
  async evaluate(
    @Param("organizationId") organizationId: string,
    @Param("agreementId") agreementId: string,
    @Param("weekNumber", ParseIntPipe) weekNumber: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agreements.evaluateWeek(organizationId, agreementId, weekNumber, user.id);
  }

  @Post(":agreementId/folders/:folderId/evaluate")
  async evaluateFolder(
    @Param("organizationId") organizationId: string,
    @Param("agreementId") agreementId: string,
    @Param("folderId") folderId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agreements.evaluateFolder(organizationId, agreementId, folderId, user.id);
  }

  @Post("evaluations/:evaluationId/create-ticket")
  async createTicket(@Param("organizationId") organizationId: string, @Param("evaluationId") evaluationId: string, @CurrentUser() user: RequestUser) {
    const payment = await this.agreements.createTicket(organizationId, evaluationId, user.id);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "posting_agreement.ticket_created",
      entityType: "payment",
      entityId: payment.id,
      metadata: { amount: payment.amount },
    });
    return payment;
  }

  /** The action the UI actually uses: records a met-target week/campaign as paid immediately,
   * with whatever proof (attachment) Finance uploads separately right after via the existing
   * payments/:paymentId/attachment endpoint. Finance-only — overrides the controller's broader
   * class-level roles: an admin (including Super Admin) can set up an agreement and follow its
   * money, but actually paying it out is exclusively Finance's action. */
  @Post("evaluations/:evaluationId/mark-paid")
  @Roles("FINANCE_OFFICER")
  async markPaid(
    @Param("organizationId") organizationId: string,
    @Param("evaluationId") evaluationId: string,
    @Body() dto: MarkAgreementPaidDto,
    @CurrentUser() user: RequestUser,
  ) {
    const payment = await this.agreements.markPaidDirectly(organizationId, evaluationId, dto, user.id);
    await this.audit.record({
      organizationId,
      userId: user.id,
      action: "posting_agreement.marked_paid",
      entityType: "payment",
      entityId: payment.id,
      metadata: { amount: payment.amount, paidAmount: payment.paidAmount },
    });
    return payment;
  }
}
