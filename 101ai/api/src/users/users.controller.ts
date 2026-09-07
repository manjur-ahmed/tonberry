import { Body, Controller, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { SetPlanDto } from './dto/set-plan.dto';
import { SetPreferencesDto } from './dto/set-preferences.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from './user.entity';
import { toPublicUser } from './user.serializer';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('plan')
  @UseGuards(JwtAuthGuard)
  async setPlan(@CurrentUser() user: User, @Body() dto: SetPlanDto) {
    return toPublicUser(await this.usersService.setPlan(user.id, dto.plan));
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async setPreferences(
    @CurrentUser() user: User,
    @Body() dto: SetPreferencesDto,
  ) {
    const updated = await this.usersService.setPreferences(user.id, {
      name: dto.name,
      otherNames: dto.otherNames ?? null,
      country: dto.country.toUpperCase(),
      darkTheme: dto.darkTheme,
    });
    return toPublicUser(updated);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  async setPassword(@CurrentUser() user: User, @Body() dto: SetPasswordDto) {
    const updated = await this.usersService.setPassword(
      user.id,
      dto.newPassword,
    );
    return toPublicUser(updated);
  }
}
