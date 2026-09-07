import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';
import { UserPlan } from '../users/user.entity';
import { ItemLimitReachedException } from './item-limit-reached.exception';

// Must match the "5 items per tool" line in web/src/lib/plans.ts.
const FREE_PLAN_ITEM_LIMIT = 5;

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
  ) {}

  async saveItem(
    userId: string,
    toolSlug: string,
    chatId: string | null | undefined,
    title: string,
    data: unknown,
    plan: UserPlan | null,
    dedupKey?: string,
  ): Promise<Item> {
    if (dedupKey) {
      const existing = await this.itemsRepository.findOne({
        where: { userId, toolSlug, dedupKey },
      });
      if (existing) {
        existing.title = title;
        existing.data = data;
        if (chatId) existing.chatId = chatId;
        return this.itemsRepository.save(existing);
      }
    }

    // Plus/Premium get unlimited items — everyone else (free, or no plan
    // yet) is capped per tool.
    if (plan !== UserPlan.PLUS && plan !== UserPlan.PREMIUM) {
      const count = await this.itemsRepository.count({
        where: { userId, toolSlug },
      });
      if (count >= FREE_PLAN_ITEM_LIMIT) throw new ItemLimitReachedException();
    }

    const item = this.itemsRepository.create({
      userId,
      toolSlug,
      chatId: chatId ?? null,
      title,
      data,
      dedupKey: dedupKey ?? null,
    });
    return this.itemsRepository.save(item);
  }

  getItemsForTool(userId: string, toolSlug: string): Promise<Item[]> {
    return this.itemsRepository.find({
      where: { userId, toolSlug },
      order: { updatedAt: 'DESC' },
    });
  }

  getAllItems(userId: string): Promise<Item[]> {
    return this.itemsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async deleteItem(userId: string, itemId: string): Promise<void> {
    // Scoped to userId so a user can't delete another user's item by guessing its id.
    await this.itemsRepository.delete({ id: itemId, userId });
  }

  async getOwnedItem(userId: string, itemId: string): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId, userId },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }
}
