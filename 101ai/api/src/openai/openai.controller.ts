import { randomUUID } from 'crypto';
import {
  BadGatewayException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OpenAiService, type HistoryMessage } from './openai.service';
import { GenerateDto } from './dto/generate.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/user.entity';

interface WriterDraft {
  title: string;
  content: string;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class OpenAiController {
  constructor(private readonly openai: OpenAiService) {}

  // Single-shot generation with no chat/message persistence — for a tool
  // like Writer where the AI's output becomes a note's content directly,
  // not a turn in an ongoing thread (see ChatsService.createChat for that
  // flow). chatId/messageId are still generated for usage-log attribution
  // (see UsageLog's comment on why those columns are unenforced uuids), but
  // no Chat or Message row is ever created.
  //
  // The reply is the writer tool's structured (title + content) json_schema
  // output (see tool-config.ts's WRITER_SCHEMA) — parsed here rather than
  // handed back as a raw JSON string, so the frontend always gets a real
  // title instead of having to derive one from the content itself.
  //
  // noteTitle/noteBody (see GenerateDto) become a single synthetic
  // "assistant" history turn — the note's current state fed back as if it
  // were the model's own prior reply, the same shape (JSON-encoded
  // {title, content}) a real prior turn would have. Without this the model
  // had zero knowledge of what it was editing on a follow-up ask inside an
  // existing note, which is exactly what let "put it inside the list"
  // produce an unrelated fruit list instead of actually revising the note.
  @Post('tools/:slug/generate')
  async generate(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Body() dto: GenerateDto,
  ): Promise<WriterDraft> {
    const history: HistoryMessage[] = dto.noteBody
      ? [
          {
            role: 'assistant',
            content: JSON.stringify({
              title: dto.noteTitle ?? '',
              content: dto.noteBody,
            }),
          },
        ]
      : [];
    const raw = await this.openai.generateReply({
      toolSlug: slug,
      message: dto.prompt,
      history,
      userId: user.id,
      chatId: randomUUID(),
      messageId: randomUUID(),
      userCountry: user.country,
    });
    try {
      return JSON.parse(raw) as WriterDraft;
    } catch {
      // Strict json_schema mode should make this unreachable in practice —
      // guarded anyway rather than letting a malformed body 500 as an
      // unrelated-looking JSON parse error.
      throw new BadGatewayException('Could not generate a reply — try again.');
    }
  }
}
