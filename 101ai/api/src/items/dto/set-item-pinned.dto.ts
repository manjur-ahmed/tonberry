import { IsBoolean } from 'class-validator';

export class SetItemPinnedDto {
  @IsBoolean()
  pinned: boolean;
}
