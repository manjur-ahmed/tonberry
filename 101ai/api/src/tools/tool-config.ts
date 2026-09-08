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
    `You are the ${entry.name} tool: ${entry.description} Help with ` +
    "requests that fit this tool's purpose, including a reasonable " +
    'follow-up or tangent about something already established earlier in ' +
    "this conversation, even if it's a bit outside your core purpose — " +
    "don't redirect just because a message alone, read in isolation, " +
    "wouldn't have started a chat here. Only redirect for a genuinely new, " +
    "unrelated request (a task another tool is meant for, or anything " +
    "unrelated to this chat so far): don't attempt it — briefly say this " +
    "isn't the right tool for that and suggest they switch to the one " +
    'that is, rather than guessing which one by name.'
  );
}

// Shared by film-recommendations and book-recommendations (and any future
// "recommend N of X" tool): a plain taste/mood request should return a
// small, curated set, but a request for a specific real series/franchise
// should return that series in full — capping it at the same fixed count
// would silently drop real entries, and the model has no other signal to
// know it's allowed to go over.
function buildRecommendationCountGuidance(itemNounPlural: string): string {
  return (
    'Two different kinds of ask need different counts. A general taste ' +
    'or mood-based request (e.g. "recommend me a thriller", "something ' +
    `like Inception") gets exactly 3 ${itemNounPlural} — a focused, ` +
    'curated set, not a longer list. A request for a specific real, ' +
    'known set — a franchise, series, saga, trilogy, or "the rest of ' +
    'X"/"what else is in this" — gets the complete real list of ' +
    "entries in that set instead, even if that's more or fewer than 3; " +
    "don't artificially trim a real series down to 3, and don't pad it " +
    `out with unrelated ${itemNounPlural} to hit a count either. When ` +
    "the count isn't fixed by a real series, prefer a mix over near-" +
    'duplicates of each other. For an unusually long real series (more ' +
    'than around a dozen entries), keep summary and whyRecommended to a ' +
    'single short clause each so the full list stays readable — still ' +
    'list every entry, just more briefly per entry.'
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

// Same 'kind' escape hatch as WORD_DEFINITION_SCHEMA, for the same reason:
// strict json_schema can't leave `films` empty for a plain "hi" or a
// clarifying follow-up ("what kind of thing are you in the mood for?"), so
// 'chat' carries the reply in `reply` with `films` as an empty array instead.
const FILM_RECOMMENDATIONS_SCHEMA: ResponseSchema = {
  name: 'film_recommendations',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['recommendations', 'chat'] },
      reply: { type: ['string', 'null'] },
      films: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            year: { type: ['string', 'null'] },
            genre: { type: ['string', 'null'] },
            summary: { type: ['string', 'null'] },
            whyRecommended: { type: ['string', 'null'] },
            // From the model's own training knowledge, not a live IMDb
            // lookup — so it's an approximation, not a guaranteed-accurate
            // score. null when the model isn't confident, rather than
            // guessing a plausible-looking number.
            imdbRating: { type: ['number', 'null'] },
          },
          required: [
            'title',
            'year',
            'genre',
            'summary',
            'whyRecommended',
            'imdbRating',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'reply', 'films'],
    additionalProperties: false,
  },
};

// Same 'kind' escape hatch as FILM_RECOMMENDATIONS_SCHEMA, for the same
// reason: strict json_schema can't leave `books` empty for a plain "hi" or
// a clarifying follow-up, so 'chat' carries the reply in `reply` with
// `books` as an empty array instead.
const BOOK_RECOMMENDATIONS_SCHEMA: ResponseSchema = {
  name: 'book_recommendations',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['recommendations', 'chat'] },
      reply: { type: ['string', 'null'] },
      books: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            author: { type: ['string', 'null'] },
            year: { type: ['string', 'null'] },
            genre: { type: ['string', 'null'] },
            summary: { type: ['string', 'null'] },
            whyRecommended: { type: ['string', 'null'] },
            // From the model's own training knowledge, not a live
            // Goodreads lookup — so it's an approximation, not a
            // guaranteed-accurate score. null when the model isn't
            // confident, rather than guessing a plausible-looking number.
            goodreadsRating: { type: ['number', 'null'] },
          },
          required: [
            'title',
            'author',
            'year',
            'genre',
            'summary',
            'whyRecommended',
            'goodreadsRating',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'reply', 'books'],
    additionalProperties: false,
  },
};

// Same 'kind' escape hatch as the other recommendation schemas, for the
// same reason: strict json_schema can't leave `songs` empty for a plain
// "hi" or a clarifying follow-up, so 'chat' carries the reply in `reply`
// with `songs` as an empty array instead.
const MUSIC_RECOMMENDATIONS_SCHEMA: ResponseSchema = {
  name: 'music_recommendations',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['recommendations', 'chat'] },
      reply: { type: ['string', 'null'] },
      songs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            artist: { type: ['string', 'null'] },
            year: { type: ['string', 'null'] },
            genre: { type: ['string', 'null'] },
            summary: { type: ['string', 'null'] },
            whyRecommended: { type: ['string', 'null'] },
            // From the model's own training knowledge, not a live Spotify
            // lookup — a rough sense of magnitude at best, not a real
            // count (a play count moves constantly, unlike a rating). null
            // when the model isn't confident, rather than guessing a
            // precise-looking number.
            spotifyPlays: { type: ['number', 'null'] },
          },
          required: [
            'title',
            'artist',
            'year',
            'genre',
            'summary',
            'whyRecommended',
            'spotifyPlays',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'reply', 'songs'],
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
  'film-recommendations': {
    model: 'gpt-4o-mini',
    task: [
      'You help the user find films to watch based on their taste.',
      'First decide `kind`: use "recommendations" once you have enough to go on — a genre, mood, actor/director, similar title, or anything else that narrows it down — and are ready to suggest films. Use "chat" for greetings, small talk, thanks, or when the request is too open-ended to recommend from yet (e.g. "recommend me something") and you need to ask a short clarifying question first (what mood, genre, or a film they already like). For "chat", write a short, warm reply in `reply` and leave `films` as an empty array.',
      `For "recommendations": leave \`reply\` null. ${buildRecommendationCountGuidance('films')} Never repeat a film already recommended earlier in this conversation unless the user asks for it again.`,
      'title is the film\'s name only, no year or extra text. year is the release year as a string (e.g. "1994"). genre is 1-3 short genre words (e.g. "Sci-Fi, Thriller"). summary is one short spoiler-free sentence on what it\'s about. whyRecommended is one short sentence on why it fits what the user asked for specifically — not a generic blurb.',
      "imdbRating is the film's approximate IMDb rating out of 10 (e.g. 8.4) from what you know — leave it null rather than guessing if you're not reasonably confident of the real figure.",
      'Keep every field concise.',
    ].join(' '),
    responseSchema: FILM_RECOMMENDATIONS_SCHEMA,
  },
  'book-recommendations': {
    model: 'gpt-4o-mini',
    task: [
      'You help the user find books to read based on their taste.',
      'First decide `kind`: use "recommendations" once you have enough to go on — a genre, mood, author, similar title, or anything else that narrows it down — and are ready to suggest books. Use "chat" for greetings, small talk, thanks, or when the request is too open-ended to recommend from yet (e.g. "recommend me something") and you need to ask a short clarifying question first (what mood, genre, or a book they already like). For "chat", write a short, warm reply in `reply` and leave `books` as an empty array.',
      `For "recommendations": leave \`reply\` null. ${buildRecommendationCountGuidance('books')} A series here also includes a numbered book series by one author (e.g. a trilogy) — not just literal film-style franchises. Never repeat a book already recommended earlier in this conversation unless the user asks for it again.`,
      'title is the book\'s name only, no author or extra text. author is the author\'s name. year is the original publication year as a string (e.g. "1994"). genre is 1-3 short genre words (e.g. "Sci-Fi, Thriller"). summary is one short spoiler-free sentence on what it\'s about. whyRecommended is one short sentence on why it fits what the user asked for specifically — not a generic blurb.',
      "goodreadsRating is the book's approximate Goodreads rating out of 5 (e.g. 4.2) from what you know — leave it null rather than guessing if you're not reasonably confident of the real figure.",
      'Keep every field concise.',
    ].join(' '),
    responseSchema: BOOK_RECOMMENDATIONS_SCHEMA,
  },
  'music-recommendations': {
    model: 'gpt-4o-mini',
    task: [
      'You help the user find songs to listen to based on their taste.',
      'First decide `kind`: use "recommendations" once you have enough to go on — a genre, mood, artist, similar song, or anything else that narrows it down — and are ready to suggest songs. Use "chat" for greetings, small talk, thanks, or when the request is too open-ended to recommend from yet (e.g. "recommend me something") and you need to ask a short clarifying question first (what mood, genre, or an artist/song they already like). For "chat", write a short, warm reply in `reply` and leave `songs` as an empty array.',
      `For "recommendations": leave \`reply\` null. ${buildRecommendationCountGuidance('songs')} A series here means a real linked set — a concept album's tracklist, or an artist's most iconic run of singles — not just "more songs by this artist" in general. Never repeat a song already recommended earlier in this conversation unless the user asks for it again.`,
      'title is the song\'s name only, no artist or extra text. artist is the performing artist or band. year is the release year as a string (e.g. "1994"). genre is 1-3 short genre words (e.g. "Indie, Rock"). summary is one short sentence on the song\'s vibe or what it\'s about. whyRecommended is one short sentence on why it fits what the user asked for specifically — not a generic blurb.',
      "spotifyPlays is the song's approximate total Spotify play count if you have a reasonable sense of its rough scale (e.g. 900000000 for a huge global hit, 5000000 for a well-known but niche track) — leave it null if you don't have a reasonable sense of the real magnitude. Round to a sensible figure rather than stating a suspiciously exact number.",
      'Keep every field concise.',
    ].join(' '),
    responseSchema: MUSIC_RECOMMENDATIONS_SCHEMA,
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
