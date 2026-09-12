import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttachmentDto } from './attachment.dto';

export class CreateChatDto {
  @IsString()
  @MinLength(1)
  message: string;

  // Set when the user chose "Stay here" on a redirect suggestion for this
  // exact message — resends it straight through without re-running
  // RouterService.check, which would otherwise just redirect it again.
  @IsOptional()
  @IsBoolean()
  skipRouter?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  // Saved item(s) to attach alongside this message (see
  // ItemPickerSheet.tsx) — ChatsService looks each up fresh by id
  // (ownership-checked) and snapshots it onto the message, same pattern as
  // createChatFromItem already uses. The frontend has no multi-select UI —
  // a user attaches more than one by reopening the picker — but the
  // backend accepts any number here.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds?: string[];
}
