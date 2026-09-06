import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SetPlanDto } from './dto/set-plan.dto';
import { SetPreferencesDto } from './dto/set-preferences.dto';
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

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  setPreferences(@CurrentUser() user: User, @Body() dto: SetPreferencesDto) {
    return this.usersService.setPreferences(user.id, {
      name: dto.name,
      otherNames: dto.otherNames ?? null,
      country: dto.country.toUpperCase(),
      darkTheme: dto.darkTheme,
    });
  }
}
