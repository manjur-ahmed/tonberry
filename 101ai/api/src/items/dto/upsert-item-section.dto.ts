import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

// News only — see NewsArticleSnapshot (items.service.ts). Real article
// data the frontend already fetched from NewsClient via NewsController,
// forwarded here just to be saved alongside the section.
class NewsArticleDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  url: string;

  @IsString()
  sourceName: string;

  @IsString()
  publishedAt: string;
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NewsArticleDto)
  articles?: NewsArticleDto[];
}
