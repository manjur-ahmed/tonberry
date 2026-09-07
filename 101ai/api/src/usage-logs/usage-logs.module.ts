import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageLog } from './usage-log.entity';
import { UsageLogsService } from './usage-logs.service';
import { UsageReportsController } from './usage-reports.controller';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UsageLog])],
  controllers: [UsageReportsController],
  providers: [UsageLogsService, AdminGuard],
  exports: [UsageLogsService],
})
export class UsageLogsModule {}
