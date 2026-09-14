import { IsIn } from 'class-validator';

// null clears an existing reaction (the user toggled it back off) — see
// MessageActions.tsx, which sends null when the currently-active button is
// clicked again.
export class SetMessageFeedbackDto {
  @IsIn(['up', 'down', null])
  feedback: 'up' | 'down' | null;
}
