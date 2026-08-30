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
 * Membership numbers/campaign IDs are sequential and human-shareable, so
 * lookup/update also require the phone or email already on file (see
 * matchesContact in members.service.ts) — knowing the identifier alone is
 * not enough. @Throttle is still a defense-in-depth layer against scripted
 * abuse of that second factor.
 */
@Public()
@Controller("api/v1/public/members")
export class PublicMembersController {
  constructor(private readonly members: MembersService) {}

  @Post("register")
  register(@Body() dto: RegisterCampaignMemberDto) {
    return this.members.registerCampaignMemberPublic(dto);
  }

  /** "Already registered?" check — looks up by membership number or campaign ID (plus the phone/email on file) so the form can autofill instead of collecting a duplicate. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("lookup")
  lookup(@Body() dto: LookupIdentifierDto) {
    return this.members.lookupByIdentifierPublic(dto.identifier, dto.contact);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("update")
  update(@Body() dto: UpdateSelfMemberDto) {
    const { identifier, contact, ...rest } = dto;
    return this.members.updateByIdentifierPublic(identifier, contact, rest);
  }
}
