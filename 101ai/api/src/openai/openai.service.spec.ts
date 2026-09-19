import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiService } from './openai.service';
import { UsageLogsService } from '../usage-logs/usage-logs.service';
import { getToolConfig } from '../tools/tool-config';

jest.mock('../tools/tool-config', () => ({
  getToolConfig: jest.fn(),
}));

const mockedGetToolConfig = getToolConfig as jest.Mock;

function makeService() {
  const config = { get: jest.fn().mockReturnValue('fake-key') } as unknown as ConfigService;
  const usageLogs = { record: jest.fn().mockResolvedValue(undefined) } as unknown as UsageLogsService;
  const service = new OpenAiService(config, usageLogs);
  // The real OpenAI client is constructed in the OpenAiService constructor
  // and calls out to the network — swapped out here for a mock so tests
  // never make a real API call.
  const mockCreate = jest.fn();
  (service as unknown as { client: { chat: { completions: { create: typeof mockCreate } } } }).client = {
    chat: { completions: { create: mockCreate } },
  };
  return { service, usageLogs, mockCreate };
}

function makeResponse(content: string, usage?: Partial<{ prompt_tokens: number; completion_tokens: number; total_tokens: number }>) {
  return {
    choices: [{ message: { content } }],
    usage: usage
      ? {
          prompt_tokens: usage.prompt_tokens ?? 10,
          completion_tokens: usage.completion_tokens ?? 5,
          total_tokens: usage.total_tokens ?? 15,
        }
      : undefined,
  };
}

describe('OpenAiService.generateReply', () => {
  beforeEach(() => {
    mockedGetToolConfig.mockReset();
  });

  it('returns the canned placeholder for a tool slug with no TOOL_DEFINITIONS entry, without calling OpenAI', async () => {
    mockedGetToolConfig.mockReturnValue(undefined);
    const { service, mockCreate, usageLogs } = makeService();

    const reply = await service.generateReply({
      toolSlug: 'not-a-real-tool',
      message: 'hi',
      history: [],
      userId: 'u1',
      chatId: 'c1',
      messageId: 'm1',
    });

    expect(reply).toContain('placeholder response');
    expect(mockCreate).not.toHaveBeenCalled();
    expect(usageLogs.record).not.toHaveBeenCalled();
  });

  it('returns the model reply and records usage on success', async () => {
    mockedGetToolConfig.mockReturnValue({ model: 'gpt-4o-mini', systemPrompt: 'sys' });
    const { service, mockCreate, usageLogs } = makeService();
    mockCreate.mockResolvedValueOnce(makeResponse('the reply', { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }));

    const reply = await service.generateReply({
      toolSlug: 'word-helper',
      message: 'define serendipity',
      history: [],
      userId: 'u1',
      chatId: 'c1',
      messageId: 'm1',
    });

    expect(reply).toBe('the reply');
    expect(usageLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        chatId: 'c1',
        messageId: 'm1',
        toolSlug: 'word-helper',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 20,
      }),
    );
  });

  it('logs the real error and throws a generic InternalServerErrorException when the OpenAI call fails', async () => {
    mockedGetToolConfig.mockReturnValue({ model: 'gpt-4o-mini', systemPrompt: 'sys' });
    const { service, mockCreate } = makeService();
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mockCreate.mockRejectedValueOnce(new Error('rate limited'));

    await expect(
      service.generateReply({
        toolSlug: 'word-helper',
        message: 'define serendipity',
        history: [],
        userId: 'u1',
        chatId: 'c1',
        messageId: 'm1',
      }),
    ).rejects.toThrow(InternalServerErrorException);

    expect(loggerSpy).toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it('upgrades to mathModelOverride only when the cheap pre-check says the turn needs real maths', async () => {
    mockedGetToolConfig.mockReturnValue({
      model: 'gpt-4o-mini',
      systemPrompt: 'sys',
      mathModelOverride: 'gpt-4o',
    });
    const { service, mockCreate } = makeService();
    mockCreate
      .mockResolvedValueOnce(makeResponse(JSON.stringify({ needsMaths: true }), { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }))
      .mockResolvedValueOnce(makeResponse('final reply', { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }));

    await service.generateReply({
      toolSlug: 'business-plan',
      message: 'work out unit economics for $5 widgets',
      history: [],
      userId: 'u1',
      chatId: 'c1',
      messageId: 'm1',
    });

    const secondCallArgs = mockCreate.mock.calls[1][0];
    expect(secondCallArgs.model).toBe('gpt-4o');
  });

  it('stays on the base model when the pre-check says maths is not needed', async () => {
    mockedGetToolConfig.mockReturnValue({
      model: 'gpt-4o-mini',
      systemPrompt: 'sys',
      mathModelOverride: 'gpt-4o',
    });
    const { service, mockCreate } = makeService();
    mockCreate
      .mockResolvedValueOnce(makeResponse(JSON.stringify({ needsMaths: false }), { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }))
      .mockResolvedValueOnce(makeResponse('final reply', { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }));

    await service.generateReply({
      toolSlug: 'business-plan',
      message: 'brainstorm names for my bakery',
      history: [],
      userId: 'u1',
      chatId: 'c1',
      messageId: 'm1',
    });

    const secondCallArgs = mockCreate.mock.calls[1][0];
    expect(secondCallArgs.model).toBe('gpt-4o-mini');
  });
});
