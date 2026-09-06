// Sequence of labels cycled through while a reply is "generating" for a
// tool. Real API calls aren't wired up yet (every reply is instant, canned
// content — see openai.service.ts on the API side), so this is purely a
// fake delay + status text for now, tailored per tool for when real
// latency shows up. Tools needing less AI horsepower get one or two quick
// stages; anything doing heavier multi-step work should get more once it's
// built out.
const loadingStages: Record<string, string[]> = {
  'word-helper': ['Looking up the word', 'Generating response'],
}

const defaultStages = ['Thinking', 'Generating response']

export const STAGE_DURATION_MS = 1100

export function getLoadingStages(slug: string): string[] {
  return loadingStages[slug] ?? defaultStages
}

// Total fake delay to hold a reply for, so the last stage gets a beat on
// screen before the real content swaps in.
export function getLoadingDuration(slug: string): number {
  return getLoadingStages(slug).length * STAGE_DURATION_MS
}
