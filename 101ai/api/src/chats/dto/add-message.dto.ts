import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class AddMessageDto {
  @IsString()
  @MinLength(1)
  content: string;

  // Set when the user chose "Stay here" on a redirect suggestion for this
  // exact message — resends it straight through without re-running
  // RouterService.check, which would otherwise just redirect it again.
  @IsOptional()
  @IsBoolean()
  skipRouter?: boolean;
}
