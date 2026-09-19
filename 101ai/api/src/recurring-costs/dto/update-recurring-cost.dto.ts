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

// Every field optional — same partial-update shape as SetPreferencesDto,
// so editing just one field (e.g. bumping the price) doesn't require
// resending the whole row.
export class UpdateRecurringCostDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountUsd?: number;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsDateString()
  renewsAt?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  notes?: string | null;
}
