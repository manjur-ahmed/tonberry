import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from './lead.entity';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { MlModule } from '../ml/ml.module';

@Module({
  imports: [TypeOrmModule.forFeature([Lead]), MlModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
