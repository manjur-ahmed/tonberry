// Per-tool model/prompt config. A tool's systemPrompt is composed from a
// shared `tone` (defaults to DEFAULT_TONE, overridable per tool) and a
// tool-specific `task` — most tools should only ever need to supply
// `task`. Only tools listed in TOOL_DEFINITIONS make a real OpenAiService
// call; every other slug still gets a canned placeholder reply (see
// openai.service.ts).

export interface ResponseSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface ToolConfig {
  model: string;
  systemPrompt: string;
  responseSchema?: ResponseSchema;
}

interface ToolDefinition {
  model: string;
  task: string;
  tone?: string;
  responseSchema?: ResponseSchema;
}

// Most tools should be conversational and friendly, not just
// results-focused — override `tone` per tool for the exceptions.
const DEFAULT_TONE =
  'You are warm, conversational, and friendly — not just focused on churning out results.';

// Structured outputs (strict json_schema) forces every property to be
// present on every reply — there's no way to "opt out" of the schema for a
// given message. Without a branch, that means a plain "hi" or "how are
// you?" still has to be crammed into a word definition (the model picks
// whatever word is nearest and defines that instead of just replying).
// `kind` gives the model an explicit escape hatch: 'chat' for anything
// that isn't really a lookup, with the definition fields left null and the
// reply going in `reply` instead.
const WORD_DEFINITION_SCHEMA: ResponseSchema = {
  name: 'word_definition',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['definition', 'chat'] },
      reply: { type: ['string', 'null'] },
      word: { type: ['string', 'null'] },
      phonetic: { type: ['string', 'null'] },
      shortDefinition: { type: ['string', 'null'] },
      meaning: { type: ['string', 'null'] },
      examples: { type: 'array', items: { type: 'string' } },
      synonyms: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'kind',
      'reply',
      'word',
      'phonetic',
      'shortDefinition',
      'meaning',
      'examples',
      'synonyms',
    ],
    additionalProperties: false,
  },
};

const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  'word-helper': {
    model: 'gpt-4o-mini',
    task: [
      'You help the user find the right word or check what a word means.',
      'First decide `kind`: use "definition" only when the user is actually asking to look up, define, or find a word or short phrase — including a question like "what does X mean?" or "another word for Y", a bare word/phrase they clearly want defined, or a follow-up that keeps asking about the word most recently discussed in this conversation (e.g. "give me more examples", "what\'s a synonym for that", "say it again") — including one introduced earlier as a JSON definition object, not just one named in the latest message. Never ask the user which word they mean if one was already established earlier in the conversation.',
      'Use "chat" for everything else — greetings, small talk, thanks, or anything that isn\'t about a specific word at all. For "chat", write a short, warm reply in `reply` and leave word/phonetic/shortDefinition/meaning null and examples/synonyms as empty arrays.',
      'For "definition": leave `reply` null. Identify the single word or short phrase being asked about — extract it out of a question or sentence, or carry it over from earlier in the conversation if the latest message doesn\'t name one.',
      'phonetic is a simple phonetic respelling for pronunciation, not IPA notation — split into syllables with hyphens and put the stressed syllable in capitals, e.g. "suh-SINGKT" for "succinct" or "HAI" for "hi".',
      'shortDefinition is one short sentence; meaning is a fuller explanation.',
      'examples are 1-2 natural sentences using the word.',
      'synonyms is a short list of similar words or short phrases.',
      'Keep every field concise.',
    ].join(' '),
    responseSchema: WORD_DEFINITION_SCHEMA,
  },
};

// null means "not wired up yet" — OpenAiService falls back to a canned
// placeholder rather than making a real call for any slug not listed in
// TOOL_DEFINITIONS.
export function getToolConfig(slug: string): ToolConfig | null {
  const definition = TOOL_DEFINITIONS[slug];
  if (!definition) return null;

  return {
    model: definition.model,
    systemPrompt: `${definition.tone ?? DEFAULT_TONE}\n\n${definition.task}`,
    responseSchema: definition.responseSchema,
  };
}
