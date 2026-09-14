import { IsString, Length } from 'class-validator';

export class CreateSuggestionDto {
  @IsString()
  @Length(1, 4000)
  content: string;
}
