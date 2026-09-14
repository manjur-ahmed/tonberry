import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

@Controller('suggestions')
@UseGuards(JwtAuthGuard)
export class SuggestionsController {
  constructor(private readonly suggestions: SuggestionsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateSuggestionDto) {
    return this.suggestions.create(user.id, user.email, dto.content);
  }

  // Admin-only (see AdminUsage/UsageReportsController's identical pattern)
  // — reached by URL from AdminSuggestions.tsx, not linked in nav.
  @Get()
  @UseGuards(AdminGuard)
  findAll() {
    return this.suggestions.findAll();
  }
}
