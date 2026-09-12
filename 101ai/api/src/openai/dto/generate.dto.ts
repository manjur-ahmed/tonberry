import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateDto {
  @IsString()
  @MinLength(1)
  prompt: string;

  // The note's current title/content, when this is a follow-up ask inside
  // a note that's already been started (see NoteEditor.tsx's in-note
  // compose bar) — omitted when starting a brand-new note from scratch
  // (ToolDashboard's "Generate with AI" option). Without this the model had
  // no idea what it was editing, which is exactly why "put it inside the
  // list" on an existing note produced an unrelated fruit list instead of
  // actually revising what was there.
  @IsOptional()
  @IsString()
  noteTitle?: string;

  @IsOptional()
  @IsString()
  noteBody?: string;
}
