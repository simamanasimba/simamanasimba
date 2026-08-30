import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { MediaHostType } from "@event-intel/database";

export class CreateMediaHostDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reachTarget?: number;

  @IsOptional()
  @IsEnum(MediaHostType)
  type?: MediaHostType;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  mediaOutletId?: string;

  @IsOptional()
  @IsString()
  channelName?: string;

  @IsOptional()
  @IsString()
  programName?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  mobileMoneyProvider?: string;

  @IsOptional()
  @IsString()
  mobileMoneyNumber?: string;
}
