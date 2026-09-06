import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SetPlanDto } from './dto/set-plan.dto';
import { SetCountryDto } from './dto/set-country.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('plan')
  @UseGuards(JwtAuthGuard)
  setPlan(@CurrentUser() user: User, @Body() dto: SetPlanDto) {
    return this.usersService.setPlan(user.id, dto.plan);
  }

  @Patch('country')
  @UseGuards(JwtAuthGuard)
  setCountry(@CurrentUser() user: User, @Body() dto: SetCountryDto) {
    return this.usersService.setCountry(user.id, dto.country.toUpperCase());
  }
}
