import { IsEnum } from 'class-validator';
import { UserPlan } from '../user.entity';

export class SetPlanDto {
  @IsEnum(UserPlan)
  plan: UserPlan;
}
