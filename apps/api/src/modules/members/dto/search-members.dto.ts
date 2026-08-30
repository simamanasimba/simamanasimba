import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { MembershipStatus, MembershipType } from "@event-intel/database";

export class SearchMembersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsEnum(MembershipType)
  membershipType?: MembershipType;

  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;

  @IsOptional()
  @IsString()
  registeredFrom?: string;

  @IsOptional()
  @IsString()
  registeredTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number = 25;

  @IsOptional()
  @IsEnum(["membershipNumber", "firstName", "lastName", "region", "membershipType", "membershipStatus", "registrationDate"])
  sortBy?: "membershipNumber" | "firstName" | "lastName" | "region" | "membershipType" | "membershipStatus" | "registrationDate";

  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortDir?: "asc" | "desc";
}
