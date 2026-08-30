import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { Gender } from "@event-intel/database";

export class UpdateSelfMemberDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  /** See LookupIdentifierDto — proof of ownership, checked against the phone/email already on file. */
  @IsString()
  @MinLength(1, { message: "Enter the phone number or email on file for this member" })
  contact!: string;

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
