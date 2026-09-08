import { IsIn, IsString, IsUUID, MinLength } from 'class-validator';

export class UpsertItemSectionDto {
  @IsString()
  @MinLength(1)
  toolSlug: string;

  @IsUUID()
  chatId: string;

  @IsString()
  @MinLength(1)
  topicTitle: string;

  @IsString()
  @MinLength(1)
  sectionHeading: string;

  @IsString()
  @MinLength(1)
  sectionBody: string;

  @IsIn(['new', 'continue'])
  sectionAction: 'new' | 'continue';
}
