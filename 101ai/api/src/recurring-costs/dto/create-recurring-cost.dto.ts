import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { BillingCycle } from '../recurring-cost.entity';

export class CreateRecurringCostDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;

  @IsNumber()
  @Min(0)
  amountUsd: number;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @IsOptional()
  @IsDateString()
  renewsAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string;
}
