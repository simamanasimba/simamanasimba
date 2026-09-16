import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateEventDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsDateString()
  startDatetime!: string;

  @IsDateString()
  endDatetime!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  attendanceEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowWalkIns?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNewMemberReg?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  requirePhoneVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCheckInNewMembers?: boolean;

  @IsOptional()
  @IsBoolean()
  limitOneResponsePerPerson?: boolean;

  @IsOptional()
  @IsString()
  recommendation?: string;

  @IsOptional()
  @IsString()
  meetingNote?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  monitoringKeywords?: string[];
}
