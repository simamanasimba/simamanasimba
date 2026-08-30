import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { MembersService } from "./members.service";
import { RegisterCampaignMemberDto } from "./dto/register-campaign-member.dto";
import { LookupIdentifierDto } from "./dto/lookup-identifier.dto";
import { UpdateSelfMemberDto } from "./dto/update-self-member.dto";
import { Public } from "../../common/decorators/public.decorator";

/**
 * Unauthenticated fan sign-up — "join as a supporter", not a system account.
 * No password, no organization.
 *
 * SECURITY NOTE: lookup/update are keyed only by membership number or
 * campaign ID, with no proof of ownership beyond knowing that identifier.
 * Membership numbers are sequential (see MembershipNumberSequence), so they
 * are enumerable — the @Throttle below only slows brute-force scraping/
 * tampering, it does not close the gap. See conversation for remediation
 * options (e.g. requiring the phone/email on file as a second factor).
 */
@Public()
@Controller("api/v1/public/members")
export class PublicMembersController {
  constructor(private readonly members: MembersService) {}

  @Post("register")
  register(@Body() dto: RegisterCampaignMemberDto) {
    return this.members.registerCampaignMemberPublic(dto);
  }

  /** "Already registered?" check — looks up by membership number or campaign ID so the form can autofill instead of collecting a duplicate. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("lookup")
  lookup(@Body() dto: LookupIdentifierDto) {
    return this.members.lookupByIdentifierPublic(dto.identifier);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("update")
  update(@Body() dto: UpdateSelfMemberDto) {
    const { identifier, ...rest } = dto;
    return this.members.updateByIdentifierPublic(identifier, rest);
  }
}
