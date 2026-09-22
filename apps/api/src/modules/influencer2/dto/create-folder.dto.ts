import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateFolderDto {
  @IsOptional()
  @IsString()
  mediaHostId?: string;

  @IsOptional()
  @IsString()
  influencerId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
