import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';
import { UserPlan } from '../users/user.entity';
import { ItemLimitReachedException } from './item-limit-reached.exception';

// Must match the "5 items per tool" line in web/src/lib/plans.ts.
const FREE_PLAN_ITEM_LIMIT = 5;

// Item.data shape for science-explainer/history-helper — see upsertSection.
// One item per chat rather than one per reply: a rabbit-hole conversation
// covering several angles on one broad subject reads back as one document
// with subheadings, not a pile of items each overwriting the last.
export interface TopicSection {
  heading: string;
  body: string;
}

export interface TopicItemData {
  title: string;
  sections: TopicSection[];
}

// Writer notes' data.body (see NoteEditor.tsx) can run far longer than any
// other tool's structured reply — the list endpoints only need enough for
// a one-line preview (see WriterItemView), so this keeps the full note text
// from shipping over the wire every time the Items tab loads. getOwnedItem
// (used when actually opening a note to edit) is untouched — this only
// applies to the two list methods below. Scoped to just the writer tool for
// now rather than a generic per-tool truncation mechanism.
const LIST_BODY_PREVIEW_LENGTH = 200;

function truncateBodyForList(item: Item): Item {
  if (item.toolSlug !== 'writer') return item;
  const data = item.data as { body?: unknown } | null;
  if (!data || typeof data.body !== 'string' || data.body.length <= LIST_BODY_PREVIEW_LENGTH) {
    return item;
  }
  return {
    ...item,
    data: { ...data, body: `${data.body.slice(0, LIST_BODY_PREVIEW_LENGTH)}…` },
  };
}

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
  ) {}

  // Plus/Premium get unlimited items — everyone else (free, or no plan
  // yet) is capped per tool. Only relevant when actually creating a new
  // item — an update to an existing one (dedup match in saveItem, or an
  // existing chat's topic item in upsertSection) never counts against it.
  private async assertUnderItemLimit(
    userId: string,
    toolSlug: string,
    plan: UserPlan | null,
  ): Promise<void> {
    if (plan === UserPlan.PLUS || plan === UserPlan.PREMIUM) return;
    const count = await this.itemsRepository.count({
      where: { userId, toolSlug },
    });
    if (count >= FREE_PLAN_ITEM_LIMIT) throw new ItemLimitReachedException();
  }

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

    await this.assertUnderItemLimit(userId, toolSlug, plan);

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

  // The topic-explainer counterpart to saveItem: dedupes on the chat id
  // itself (one item per chat, not one per reply) and merges into the
  // existing item's sections instead of replacing `data` wholesale.
  // 'continue' appends onto the last section rather than replacing it, so
  // a follow-up reply never silently drops what was already said there.
  async upsertSection(
    userId: string,
    toolSlug: string,
    chatId: string,
    plan: UserPlan | null,
    params: {
      topicTitle: string;
      sectionHeading: string;
      sectionBody: string;
      sectionAction: 'new' | 'continue';
    },
  ): Promise<Item> {
    const existing = await this.itemsRepository.findOne({
      where: { userId, toolSlug, dedupKey: chatId },
    });

    if (!existing) {
      await this.assertUnderItemLimit(userId, toolSlug, plan);
      const data: TopicItemData = {
        title: params.topicTitle,
        sections: [
          { heading: params.sectionHeading, body: params.sectionBody },
        ],
      };
      const item = this.itemsRepository.create({
        userId,
        toolSlug,
        chatId,
        title: params.topicTitle,
        data,
        dedupKey: chatId,
      });
      return this.itemsRepository.save(item);
    }

    const data = existing.data as TopicItemData;
    const lastSection = data.sections[data.sections.length - 1];
    if (params.sectionAction === 'continue' && lastSection) {
      lastSection.body = `${lastSection.body}\n\n${params.sectionBody}`;
    } else {
      data.sections.push({
        heading: params.sectionHeading,
        body: params.sectionBody,
      });
    }
    existing.data = data;
    return this.itemsRepository.save(existing);
  }

  async getItemsForTool(userId: string, toolSlug: string): Promise<Item[]> {
    const items = await this.itemsRepository.find({
      where: { userId, toolSlug },
      order: { updatedAt: 'DESC' },
    });
    return items.map(truncateBodyForList);
  }

  async getAllItems(userId: string): Promise<Item[]> {
    const items = await this.itemsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return items.map(truncateBodyForList);
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
