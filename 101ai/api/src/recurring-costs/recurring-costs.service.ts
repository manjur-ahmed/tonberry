import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingCycle, RecurringCost } from './recurring-cost.entity';
import { CreateRecurringCostDto } from './dto/create-recurring-cost.dto';
import { UpdateRecurringCostDto } from './dto/update-recurring-cost.dto';

@Injectable()
export class RecurringCostsService {
  constructor(
    @InjectRepository(RecurringCost)
    private readonly recurringCostsRepository: Repository<RecurringCost>,
  ) {}

  findAll(): Promise<RecurringCost[]> {
    // Soonest-renewing first — the thing most likely to need attention.
    return this.recurringCostsRepository.find({
      order: { renewsAt: 'ASC', name: 'ASC' },
    });
  }

  create(dto: CreateRecurringCostDto): Promise<RecurringCost> {
    const cost = this.recurringCostsRepository.create({
      name: dto.name,
      category: dto.category ?? null,
      amountUsd: dto.amountUsd.toFixed(2),
      billingCycle: dto.billingCycle,
      renewsAt: dto.renewsAt ?? null,
      notes: dto.notes ?? null,
    });
    return this.recurringCostsRepository.save(cost);
  }

  async update(id: string, dto: UpdateRecurringCostDto): Promise<RecurringCost> {
    const existing = await this.recurringCostsRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException('Recurring cost not found');

    await this.recurringCostsRepository.update(
      { id },
      {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amountUsd !== undefined
          ? { amountUsd: dto.amountUsd.toFixed(2) }
          : {}),
        ...(dto.billingCycle !== undefined
          ? { billingCycle: dto.billingCycle }
          : {}),
        ...(dto.renewsAt !== undefined ? { renewsAt: dto.renewsAt } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    );
    const updated = await this.recurringCostsRepository.findOneBy({ id });
    if (!updated) throw new NotFoundException('Recurring cost not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.recurringCostsRepository.delete({ id });
    if (!result.affected) throw new NotFoundException('Recurring cost not found');
  }

  // Normalizes every active recurring cost onto a common monthly figure
  // (yearly / 12, monthly as-is) so the summary total means something —
  // one-time costs already happened and never recur, so they're excluded
  // rather than distorting a "per month" number.
  async getMonthlyTotalUsd(): Promise<number> {
    const costs = await this.findAll();
    return costs.reduce((total, cost) => {
      const amount = Number(cost.amountUsd);
      if (cost.billingCycle === BillingCycle.MONTHLY) return total + amount;
      if (cost.billingCycle === BillingCycle.YEARLY) return total + amount / 12;
      return total;
    }, 0);
  }
}
