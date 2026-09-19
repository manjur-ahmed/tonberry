import { RouterService } from './router.service';

describe('RouterService', () => {
  let service: RouterService;

  beforeEach(() => {
    service = new RouterService();
  });

  it('never redirects, regardless of message content or current tool', () => {
    expect(service.check('help me with a business plan', 'word-helper')).toEqual({
      redirect: false,
    });
    expect(service.check('write me a blog post', 'writer')).toEqual({
      redirect: false,
    });
    expect(service.check('', '')).toEqual({ redirect: false });
  });
});
