import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { InfluencerType } from "@event-intel/database";

export class CreateInfluencerDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(InfluencerType)
  type?: InfluencerType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reachTarget?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalPhones?: string[];

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  socialHandle?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  contractStartDate?: string;

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
