import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringCost } from './recurring-cost.entity';
import { RecurringCostsService } from './recurring-costs.service';
import { RecurringCostsController } from './recurring-costs.controller';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([RecurringCost])],
  controllers: [RecurringCostsController],
  providers: [RecurringCostsService, AdminGuard],
})
export class RecurringCostsModule {}
