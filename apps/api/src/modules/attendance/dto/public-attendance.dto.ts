import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { Gender } from "@event-intel/database";

export class ValidateTokenDto {
  @IsString()
  token!: string;
}

export class LookupMemberDto {
  @IsString()
  token!: string;

  @IsString()
  phone!: string;
}

export class CheckPhoneDto {
  @IsString()
  token!: string;

  @IsString()
  phone!: string;
}

export class CheckInDto {
  @IsString()
  token!: string;

  @IsString()
  memberId!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  clientRecordId?: string;
}

export class RegisterWalkInDto {
  @IsString()
  token!: string;

  /** Filled in by the person if the club already assigned them one — never auto-generated. */
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

  @IsString()
  phone!: string;

  @IsEmail()
  email!: string;

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
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  clientRecordId?: string;
}

export class SyncItemDto {
  @IsString()
  clientRecordId!: string;

  @IsString()
  memberId!: string;

  @IsString()
  checkedInAt!: string;
}

export class SyncBatchDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  items!: SyncItemDto[];
}
