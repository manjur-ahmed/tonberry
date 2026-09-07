import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  toolSlug: string;

  @IsOptional()
  @IsUUID()
  chatId?: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsOptional()
  @IsString()
  dedupKey?: string;
}
