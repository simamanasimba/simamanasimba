import { Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, IsUrl, Min } from "class-validator";

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mediaReachTarget?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  memberTarget?: number | null;
}
