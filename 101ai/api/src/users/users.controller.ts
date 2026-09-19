import { Body, Controller, Delete, Patch, UseGuards } from '@nestjs/common';
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

  @Patch('trial')
  @UseGuards(JwtAuthGuard)
  async startTrial(@CurrentUser() user: User) {
    return toPublicUser(await this.usersService.startTrial(user.id));
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async setPreferences(
    @CurrentUser() user: User,
    @Body() dto: SetPreferencesDto,
  ) {
    // Only include a key when the caller actually sent it — see
    // SetPreferencesDto/UsersService.setPreferences' comments for why (each
    // onboarding step now PATCHes just what it collects).
    const updated = await this.usersService.setPreferences(user.id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.otherNames !== undefined ? { otherNames: dto.otherNames } : {}),
      ...(dto.country !== undefined ? { country: dto.country.toUpperCase() } : {}),
      ...(dto.darkTheme !== undefined ? { darkTheme: dto.darkTheme } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth } : {}),
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

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deleteAccount(@CurrentUser() user: User) {
    return this.usersService.deleteAccount(user.id);
  }
}
