import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class RegionTargetInput {
  @IsString()
  @MinLength(1)
  region!: string;

  @IsOptional()
  @IsInt()
  memberTarget?: number | null;

  @IsOptional()
  @IsInt()
  leaderTarget?: number | null;
}

export class UpsertRegionTargetsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RegionTargetInput)
  targets!: RegionTargetInput[];
}
