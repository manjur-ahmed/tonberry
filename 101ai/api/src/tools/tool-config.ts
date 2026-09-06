// Per-tool model/prompt config. Unused until OpenAiService makes real
// calls — the shape exists now so wiring up the real API later is a
// config change, not a restructure. Tools with no entry fall back to
// DEFAULT_CONFIG.

export interface ToolConfig {
  model: string;
  systemPrompt: string;
}

const DEFAULT_CONFIG: ToolConfig = {
  model: 'gpt-4o-mini',
  systemPrompt: 'You are a helpful assistant.',
};

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  'word-helper': {
    model: 'gpt-4o-mini',
    systemPrompt:
      'You help the user find the right word or check what a word means. Keep answers short and clear.',
  },
};

export function getToolConfig(slug: string): ToolConfig {
  return TOOL_CONFIGS[slug] ?? DEFAULT_CONFIG;
}
