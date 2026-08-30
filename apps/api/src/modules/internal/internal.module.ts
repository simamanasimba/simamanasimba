import { Module } from "@nestjs/common";
import { InternalController } from "./internal.controller";
import { MonitoringModule } from "../monitoring/monitoring.module";

@Module({
  imports: [MonitoringModule],
  controllers: [InternalController],
})
export class InternalModule {}
