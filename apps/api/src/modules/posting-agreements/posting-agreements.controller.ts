import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PostingAgreementsService } from "./posting-agreements.service";
import { CreatePostingAgreementDto } from "./dto/create-posting-agreement.dto";
import { UpdatePostingAgreementDto } from "./dto/update-posting-agreement.dto";
import { OrgMembershipGuard } from "../../common/guards/org-membership.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { RequiresArea } from "../../common/decorators/requires-area.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types";
import { AuditService } from "../../common/audit.service";

@Controller("api/v1/organizations/:organizationId/posting-agreements")
@UseGuards(OrgMembershipGuard, RolesGuard)
@Roles("ORG_SUPER_ADMIN", "ORG_ADMIN", "FINANCE_OFFICER")
@RequiresArea("finance")
export class PostingAgreementsController {
  constructor(
    private readonly agreements: PostingAgreementsService,
    private readonly audit: AuditService,
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
}
