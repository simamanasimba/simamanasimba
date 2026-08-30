import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { MembershipStatus, MembershipType } from "@event-intel/database";

export class SendCampaignDto {
  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(MembershipType)
  membershipType?: MembershipType;

  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;
}
