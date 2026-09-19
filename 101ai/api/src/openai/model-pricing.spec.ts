import { calculateCostUsd, MODEL_PRICING } from './model-pricing';

describe('calculateCostUsd', () => {
  it('prices a known model off its input/output per-1M rates', () => {
    // gpt-4o-mini: $0.15 / 1M input, $0.60 / 1M output (see MODEL_PRICING).
    const cost = calculateCostUsd('gpt-4o-mini', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.15 + 0.6, 10);
  });

  it('prices a proportional fraction of a million tokens correctly', () => {
    const cost = calculateCostUsd('gpt-4o-mini', 500_000, 0);
    expect(cost).toBeCloseTo(0.075, 10);
  });

  it('prices an input-only model (no output tokens) using just the input rate', () => {
    const cost = calculateCostUsd('text-embedding-3-small', 1_000_000, 0);
    expect(cost).toBeCloseTo(MODEL_PRICING['text-embedding-3-small'].inputPer1M, 10);
  });

  it('returns 0 for a model missing from MODEL_PRICING, rather than throwing', () => {
    expect(calculateCostUsd('some-future-model', 1_000_000, 1_000_000)).toBe(0);
  });

  it('returns 0 for zero tokens on a known model', () => {
    expect(calculateCostUsd('gpt-4o', 0, 0)).toBe(0);
  });
});
