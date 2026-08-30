import { IsBoolean, IsDateString, IsEmail, IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { Gender, MembershipType } from "@event-intel/database";

export class CreateMemberDto {
  /** An external club membership number the person already holds — never invented by this system. */
  @IsOptional()
  @IsString()
  membershipNumber?: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;

  @IsOptional()
  @IsEnum(MembershipType)
  membershipType?: MembershipType;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
