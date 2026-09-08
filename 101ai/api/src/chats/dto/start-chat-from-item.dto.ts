import { IsOptional, IsString, MinLength } from 'class-validator';

export class StartChatFromItemDto {
  // Omit to start the chat in the item's own tool (the default, existing
  // behaviour) — set to send the item to a different tool instead (see
  // "Open in another tool" on ItemDetailModal).
  @IsOptional()
  @IsString()
  @MinLength(1)
  targetToolSlug?: string;
}
