// $ per 1M tokens. Best-known rates as of when this was written — NOT
// guaranteed current. Verify against https://openai.com/api/pricing/
// before trusting cost figures for real budgeting decisions, and update
// here (not per-call) if it's drifted — costUsd is snapshotted at insert
// time, so a correction here only affects new rows, not history.
export const MODEL_PRICING: Record<
  string,
  { inputPer1M: number; outputPer1M: number }
> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  // salary-calculator only (see tool-config.ts) — every other tool is on mini.
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
};

export function calculateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (
    (promptTokens / 1_000_000) * pricing.inputPer1M +
    (completionTokens / 1_000_000) * pricing.outputPer1M
  );
}
