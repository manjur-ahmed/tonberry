import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SetPreferencesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  otherNames?: string;

  @Length(2, 2)
  country: string;

  @IsBoolean()
  darkTheme: boolean;
}
