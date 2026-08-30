import { Module } from "@nestjs/common";
import { PlatformCapabilitiesController } from "./platform-capabilities.controller";

@Module({
  controllers: [PlatformCapabilitiesController],
})
export class PlatformCapabilitiesModule {}
