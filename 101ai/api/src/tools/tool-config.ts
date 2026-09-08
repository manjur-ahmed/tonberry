// Per-tool model/prompt config. A tool's systemPrompt is composed from a
// shared `tone` (defaults to DEFAULT_TONE, overridable per tool), a
// catalog-driven scope guard (see buildScopeGuard), and a tool-specific
// `task` — most tools should only ever need to supply `task`. Only tools
// listed in TOOL_DEFINITIONS make a real OpenAiService call; every other
// slug still gets a canned placeholder reply (see openai.service.ts).

import { getToolCatalogEntry } from './tool-catalog';

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

// RouterService is meant to redirect an off-topic message to the right tool
// before it ever reaches here, but today it's a placeholder single-keyword
// rule (see router.service.ts) that misses almost everything — so this is
// the backstop. Built from TOOL_CATALOG (name + description) rather than
// hardcoded per tool, so every tool gets it automatically and it can't drift
// out of sync with the catalog.
function buildScopeGuard(slug: string): string {
  const entry = getToolCatalogEntry(slug);
  if (!entry) return '';
  return (
    `You are the ${entry.name} tool: ${entry.description} Only help with ` +
    "requests that fit this tool's purpose. If the user asks for something " +
    "clearly outside it (a task another tool is meant for, or anything " +
    "unrelated), don't attempt it — briefly say this isn't the right tool " +
    'for that and suggest they switch to the one that is, rather than ' +
    'guessing which one by name.'
  );
}

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
      'First decide `kind`: use "definition" whenever the user is actually asking to look up, define, or find a word or short phrase — including a question like "what does X mean?", a bare word/phrase they clearly want defined, a follow-up about a word already established earlier in this conversation, or a request for a different/similar/related word. A word can be established by an earlier message, including one shown for reference as an item the user is viewing (e.g. a JSON definition object) — not only one named in the latest message. Never ask the user which word they mean if one was already established earlier in the conversation.',
      'Within "definition", a follow-up about an already-established word is one of two opposite things, and getting this right matters: it either asks for MORE about that SAME word — e.g. more examples, the pronunciation, "tell me more", "say it again" — in which case keep `word` exactly as it was; or it asks you to switch to a DIFFERENT word as the new subject — e.g. "give me a similar word", "another word for that", "what else could I use instead" — in which case `word` must change to a new term (such as one of the synonyms you previously gave, or another closely related word), never a repeat of the previous `word`. Judge which one it is from what the user is actually asking for, not from fixed phrases.',
      'Use "chat" for everything else — greetings, small talk, thanks, or anything that isn\'t about a specific word at all. For "chat", write a short, warm reply in `reply` and leave word/phonetic/shortDefinition/meaning null and examples/synonyms as empty arrays.',
      'For "definition": leave `reply` null. Identify the single word or short phrase being asked about — extract it out of a question or sentence, carry it over from earlier in the conversation if the latest message doesn\'t name one and isn\'t asking for a different word, or choose a new one per the rule above when it is.',
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

  const scopeGuard = buildScopeGuard(slug);
  return {
    model: definition.model,
    systemPrompt: [definition.tone ?? DEFAULT_TONE, scopeGuard, definition.task]
      .filter(Boolean)
      .join('\n\n'),
    responseSchema: definition.responseSchema,
  };
}
