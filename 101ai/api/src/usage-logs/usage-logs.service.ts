import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageLog } from './usage-log.entity';
import { calculateCostUsd } from '../openai/model-pricing';

export interface RecordUsageParams {
  userId: string;
  chatId: string | null;
  messageId: string | null;
  toolSlug: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

@Injectable()
export class UsageLogsService {
  constructor(
    @InjectRepository(UsageLog)
    private readonly usageLogsRepository: Repository<UsageLog>,
  ) {}

  // Never let a broken usage-log insert break the user's actual chat
  // reply — this is purely observability, not core functionality.
  async record(params: RecordUsageParams): Promise<void> {
    try {
      const costUsd = calculateCostUsd(
        params.model,
        params.promptTokens,
        params.completionTokens,
      );
      const log = this.usageLogsRepository.create({
        userId: params.userId,
        chatId: params.chatId,
        messageId: params.messageId,
        toolSlug: params.toolSlug,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        cachedTokens: params.cachedTokens ?? 0,
        costUsd: costUsd.toFixed(8),
      });
      await this.usageLogsRepository.save(log);
    } catch (error) {
      console.error('Failed to record AI usage log', error);
    }
  }
}
