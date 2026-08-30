import { IsEnum, IsOptional, IsString } from "class-validator";
import { DeviceType } from "@event-intel/database";

export class RegisterDeviceDto {
  @IsString()
  name!: string;

  @IsEnum(DeviceType)
  deviceType!: DeviceType;

  @IsOptional()
  @IsString()
  eventId?: string;
}
