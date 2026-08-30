import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Gender } from "@event-intel/database";

export class UpdateSelfMemberDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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
}
