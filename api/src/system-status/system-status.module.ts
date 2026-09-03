import { Module } from '@nestjs/common';
import { SystemStatusController } from './system-status.controller';

@Module({
  controllers: [SystemStatusController],
})
export class SystemStatusModule {}
