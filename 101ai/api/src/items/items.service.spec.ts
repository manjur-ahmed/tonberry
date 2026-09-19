import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ItemsService, TopicItemData } from './items.service';
import { Item } from './item.entity';
import { UserPlan } from '../users/user.entity';
import { ItemLimitReachedException } from './item-limit-reached.exception';

function makeRepository() {
  return {
    count: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: Partial<Item>) => data as Item),
    save: jest.fn(async (item: Item) => item),
    delete: jest.fn(),
  } as unknown as jest.Mocked<Repository<Item>>;
}

describe('ItemsService', () => {
  let itemsRepository: jest.Mocked<Repository<Item>>;
  let service: ItemsService;

  beforeEach(() => {
    itemsRepository = makeRepository();
    service = new ItemsService(itemsRepository);
  });

  describe('saveItem', () => {
    it('creates a new item when a free/basic-plan user is under the 5-item cap', async () => {
      itemsRepository.count.mockResolvedValueOnce(4);

      const result = await service.saveItem('u1', 'word-helper', null, 'Title', { x: 1 }, null);

      expect(result.title).toBe('Title');
      expect(itemsRepository.save).toHaveBeenCalled();
    });

    it('rejects a new item once a basic-plan user has hit the 5-item cap for that tool', async () => {
      itemsRepository.count.mockResolvedValueOnce(5);

      await expect(
        service.saveItem('u1', 'word-helper', null, 'Title', { x: 1 }, UserPlan.BASIC),
      ).rejects.toThrow(ItemLimitReachedException);
    });

    it('never checks the item cap for a Plus-plan user', async () => {
      const result = await service.saveItem('u1', 'word-helper', null, 'Title', { x: 1 }, UserPlan.PLUS);

      expect(itemsRepository.count).not.toHaveBeenCalled();
      expect(result.title).toBe('Title');
    });

    it('never checks the item cap for a Premium-plan user', async () => {
      await service.saveItem('u1', 'word-helper', null, 'Title', { x: 1 }, UserPlan.PREMIUM);

      expect(itemsRepository.count).not.toHaveBeenCalled();
    });

    it('updates the existing item in place on a dedupKey match, without counting against the limit', async () => {
      const existing = { id: 'i1', title: 'Old', data: {} } as Item;
      itemsRepository.findOne.mockResolvedValueOnce(existing);

      const result = await service.saveItem(
        'u1',
        'word-helper',
        'chat-1',
        'New Title',
        { x: 2 },
        UserPlan.BASIC,
        'dedup-key',
      );

      expect(itemsRepository.count).not.toHaveBeenCalled();
      expect(itemsRepository.create).not.toHaveBeenCalled();
      expect(result.title).toBe('New Title');
      expect(result.chatId).toBe('chat-1');
    });

    it('falls through to the normal create path when a dedupKey is given but nothing matches it yet', async () => {
      itemsRepository.findOne.mockResolvedValueOnce(null);
      itemsRepository.count.mockResolvedValueOnce(0);

      const result = await service.saveItem(
        'u1',
        'word-helper',
        null,
        'Title',
        { x: 1 },
        UserPlan.BASIC,
        'dedup-key',
      );

      expect(result.dedupKey).toBe('dedup-key');
      expect(itemsRepository.create).toHaveBeenCalled();
    });
  });

  describe('upsertSection', () => {
    it('creates a new topic item (one section) when none exists for this chat yet', async () => {
      itemsRepository.findOne.mockResolvedValueOnce(null);
      itemsRepository.count.mockResolvedValueOnce(0);

      const result = await service.upsertSection('u1', 'news', 'chat-1', UserPlan.BASIC, {
        topicTitle: 'Topic',
        sectionHeading: 'Heading',
        sectionBody: 'Body',
        sectionAction: 'new',
      });

      const data = result.data as TopicItemData;
      expect(data.sections).toHaveLength(1);
      expect(result.dedupKey).toBe('chat-1');
    });

    it('respects the item cap when creating the first section for a new chat', async () => {
      itemsRepository.findOne.mockResolvedValueOnce(null);
      itemsRepository.count.mockResolvedValueOnce(5);

      await expect(
        service.upsertSection('u1', 'news', 'chat-1', UserPlan.BASIC, {
          topicTitle: 'Topic',
          sectionHeading: 'Heading',
          sectionBody: 'Body',
          sectionAction: 'new',
        }),
      ).rejects.toThrow(ItemLimitReachedException);
    });

    it('appends onto the last section in place for a "continue" action', async () => {
      const existing = {
        id: 'i1',
        data: {
          title: 'Topic',
          sections: [{ heading: 'H1', body: 'First part.' }],
        } as TopicItemData,
      } as Item;
      itemsRepository.findOne.mockResolvedValueOnce(existing);

      const result = await service.upsertSection('u1', 'news', 'chat-1', UserPlan.BASIC, {
        topicTitle: 'Topic',
        sectionHeading: 'H1',
        sectionBody: 'More detail.',
        sectionAction: 'continue',
      });

      const data = result.data as TopicItemData;
      expect(data.sections).toHaveLength(1);
      expect(data.sections[0].body).toBe('First part.\n\nMore detail.');
    });

    it('pushes a new section rather than merging when sectionAction is "new" on an existing topic', async () => {
      const existing = {
        id: 'i1',
        data: {
          title: 'Topic',
          sections: [{ heading: 'H1', body: 'First part.' }],
        } as TopicItemData,
      } as Item;
      itemsRepository.findOne.mockResolvedValueOnce(existing);

      const result = await service.upsertSection('u1', 'news', 'chat-1', UserPlan.BASIC, {
        topicTitle: 'Topic',
        sectionHeading: 'H2',
        sectionBody: 'Second angle.',
        sectionAction: 'new',
      });

      const data = result.data as TopicItemData;
      expect(data.sections).toHaveLength(2);
      expect(data.sections[1].heading).toBe('H2');
    });
  });

  describe('getItemsForTool', () => {
    it('truncates a long writer note body for the list view', async () => {
      const longBody = 'x'.repeat(250);
      itemsRepository.find.mockResolvedValueOnce([
        { toolSlug: 'writer', data: { body: longBody } } as unknown as Item,
      ]);

      const [item] = await service.getItemsForTool('u1', 'writer');

      const data = item.data as { body: string };
      expect(data.body.length).toBeLessThan(longBody.length);
      expect(data.body.endsWith('…')).toBe(true);
    });

    it('leaves a non-writer item untouched regardless of body length', async () => {
      const longBody = 'x'.repeat(250);
      itemsRepository.find.mockResolvedValueOnce([
        { toolSlug: 'word-helper', data: { body: longBody } } as unknown as Item,
      ]);

      const [item] = await service.getItemsForTool('u1', 'word-helper');

      expect((item.data as { body: string }).body).toBe(longBody);
    });
  });

  describe('getOwnedItem', () => {
    it('throws NotFoundException when the item does not exist or belongs to someone else', async () => {
      itemsRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getOwnedItem('u1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setPinned', () => {
    it('toggles pinned on the owned item and saves it', async () => {
      const item = { id: 'i1', userId: 'u1', pinned: false } as Item;
      itemsRepository.findOne.mockResolvedValueOnce(item);

      const result = await service.setPinned('u1', 'i1', true);

      expect(result.pinned).toBe(true);
      expect(itemsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ pinned: true }));
    });
  });

  describe('deleteItem', () => {
    it('scopes the delete to both the item id and the owning user', async () => {
      await service.deleteItem('u1', 'i1');

      expect(itemsRepository.delete).toHaveBeenCalledWith({ id: 'i1', userId: 'u1' });
    });
  });
});
