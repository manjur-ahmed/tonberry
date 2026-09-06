import { ForbiddenException } from '@nestjs/common';

// A distinct code (rather than just the 403 status) so the frontend can
// tell "you're out of space on the free plan" apart from any other save
// failure and show the upgrade prompt only for this one.
export class ItemLimitReachedException extends ForbiddenException {
  constructor() {
    super({ code: 'ITEM_LIMIT_REACHED', message: 'Item limit reached for this plan' });
  }
}
