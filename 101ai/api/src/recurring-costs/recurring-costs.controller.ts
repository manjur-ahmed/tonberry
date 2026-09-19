import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RecurringCostsService } from './recurring-costs.service';
import { CreateRecurringCostDto } from './dto/create-recurring-cost.dto';
import { UpdateRecurringCostDto } from './dto/update-recurring-cost.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

// Fully admin-only (unlike SuggestionsController, nothing here is ever
// called by an ordinary user) — reached by URL from AdminCosts.tsx, not
// linked in nav, same pattern as AdminUsage/AdminSuggestions.
@Controller('admin/costs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RecurringCostsController {
  constructor(private readonly recurringCosts: RecurringCostsService) {}

  @Get()
  async findAll() {
    const [costs, monthlyTotalUsd] = await Promise.all([
      this.recurringCosts.findAll(),
      this.recurringCosts.getMonthlyTotalUsd(),
    ]);
    return { costs, monthlyTotalUsd };
  }

  @Post()
  create(@Body() dto: CreateRecurringCostDto) {
    return this.recurringCosts.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecurringCostDto) {
    return this.recurringCosts.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.recurringCosts.remove(id);
  }
}
