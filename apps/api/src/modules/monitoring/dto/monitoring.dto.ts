import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";
import { AliasType, MonitoringQueryType } from "@event-intel/database";

export class CreateAliasDto {
  @IsString()
  alias!: string;

  @IsEnum(AliasType)
  aliasType!: AliasType;
}

export class CreateMonitoringQueryDto {
  @IsEnum(MonitoringQueryType)
  queryType!: MonitoringQueryType;

  @IsString()
  value!: string;
}

export class CreateMonitoringRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsArray()
  queries!: CreateMonitoringQueryDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];
}
