import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

// Every field is optional here — the old single /country step now spans
// three pages (Country, Location, Theme), each PATCHing only what it
// actually collects (see UsersController.setPreferences), rather than one
// page having to resend every other page's already-saved answer just to
// satisfy a "must send everything" validator.
export class SetPreferencesDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  otherNames?: string;

  @IsOptional()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsBoolean()
  darkTheme?: boolean;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
