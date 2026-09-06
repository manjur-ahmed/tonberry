import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';

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
    dedupKey?: string,
  ): Promise<Item> {
    if (dedupKey) {
      const existing = await this.itemsRepository.findOne({ where: { userId, toolSlug, dedupKey } });
      if (existing) {
        existing.title = title;
        existing.data = data;
        if (chatId) existing.chatId = chatId;
        return this.itemsRepository.save(existing);
      }
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
}
