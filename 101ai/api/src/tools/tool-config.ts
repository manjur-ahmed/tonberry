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
  // Overrides OpenAiService's default MAX_COMPLETION_TOKENS when a tool
  // needs a deliberately smaller (or larger) ceiling — e.g. story-explainer
  // sizing its cap to roughly one minute of reading time.
  maxCompletionTokens?: number;
}

interface ToolDefinition {
  model: string;
  task: string;
  tone?: string;
  responseSchema?: ResponseSchema;
  maxCompletionTokens?: number;
  // Opts into telling the model which country the user is in (see
  // buildResidencyContext) — only relevant for a tool where the right
  // answer actually depends on jurisdiction, e.g. Politics & Law's "what's
  // the law on running a red light" needing to know whose law. Most tools
  // have no use for this, so it's opt-in rather than sent to every tool.
  usesResidencyContext?: boolean;
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
    'unrelated request (a task another tool is meant for, or anything ' +
    "unrelated to this chat so far): don't attempt it — briefly say this " +
    "isn't the right tool for that and suggest they switch to the one " +
    'that is, rather than guessing which one by name.'
  );
}

// Only added for a tool that opts in via usesResidencyContext — most tools
// have no use for the user's location. countryCode is User.country
// (ISO 3166-1 alpha-2, e.g. "GB") straight from the DB, not translated to a
// full country name first: the model already knows these codes well, and a
// translation step is just another place a wrong mapping could creep in.
function buildResidencyContext(countryCode: string): string {
  return (
    `The user is based in ${countryCode} (an ISO 3166-1 country code). ` +
    'When a question depends on jurisdiction — a specific law, traffic ' +
    'rule, tax, or policy — answer for this country by default, and name ' +
    'the country explicitly in your answer (e.g. "In the UK, ...") rather ' +
    "than leaving it ambiguous which country you mean. If they've clearly " +
    'asked about a different country or region instead, answer for that ' +
    'one instead.'
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

// Same 'kind' escape hatch as the other tools, for the same reason: strict
// json_schema can't leave `title`/`explanation` null for a plain "hi" or a
// request that hasn't named a story yet, so 'chat' carries the reply in
// `reply` instead.
const STORY_EXPLAINER_SCHEMA: ResponseSchema = {
  name: 'story_explanation',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['explanation', 'chat'] },
      reply: { type: ['string', 'null'] },
      title: { type: ['string', 'null'] },
      year: { type: ['string', 'null'] },
      explanation: { type: ['string', 'null'] },
    },
    required: ['kind', 'reply', 'title', 'year', 'explanation'],
    additionalProperties: false,
  },
};

// Same 'kind' escape hatch as the other tools — also doubles as the "I'm
// not confident enough to state this as fact" path (see the task prompt
// below), so a request the model can't verify comes back as a plain,
// honest `reply` instead of a schema-shaped but fabricated quote.
//
// Deliberately no `url`/`videoUrl` field: a model-generated link is exactly
// the kind of thing that gets hallucinated (a plausible-looking but dead or
// wrong URL), which is worse than no link at all for a tool whose whole
// point is proof. The frontend instead builds a YouTube *search* link out
// of the verified text/speaker/source fields below — always a real,
// resolvable URL, never a fabricated one.
const QUOTE_FINDER_SCHEMA: ResponseSchema = {
  name: 'quote_finder',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['quotes', 'chat'] },
      reply: { type: ['string', 'null'] },
      quotes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            speaker: { type: ['string', 'null'] },
            source: { type: 'string' },
            sourceType: {
              type: 'string',
              enum: [
                'movie',
                'tv-show',
                'book',
                'song',
                'interview',
                'video',
                'other',
              ],
            },
            year: { type: ['string', 'null'] },
          },
          required: ['text', 'speaker', 'source', 'sourceType', 'year'],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'reply', 'quotes'],
    additionalProperties: false,
  },
};

// Shared by science-explainer and history-helper — both save one item per
// *chat*, not one per reply (see ItemsService.upsertSection): a rabbit-hole
// conversation covering several angles on one broad subject should read
// back as one document with subheadings, not a pile of items each
// overwriting the last. `sectionAction` mirrors word-helper's existing
// same-word/different-word `kind` distinction, one level down: 'continue'
// only for a direct follow-up on the exact same specific point just
// discussed (appended onto that subheading server-side, never replacing
// it — see the task text below); 'new' for a different specific question
// or angle, even within the same broad topic. `topicTitle` is the umbrella
// subject and is only actually consumed on the *first* reply saved in a
// chat (see ItemsService.upsertSection) — later replies still have to
// supply it (strict json_schema requires every field every time), but it's
// otherwise ignored once the item exists. Same 'kind' escape hatch as every
// other tool, for the same reason: strict json_schema can't leave the rest
// null for a plain "hi" or a request that hasn't named a topic yet.
const TOPIC_EXPLAINER_SCHEMA: ResponseSchema = {
  name: 'topic_explanation',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['explanation', 'chat'] },
      reply: { type: ['string', 'null'] },
      topicTitle: { type: ['string', 'null'] },
      sectionHeading: { type: ['string', 'null'] },
      sectionBody: { type: ['string', 'null'] },
      sectionAction: {
        type: ['string', 'null'],
        enum: ['new', 'continue', null],
      },
    },
    required: [
      'kind',
      'reply',
      'topicTitle',
      'sectionHeading',
      'sectionBody',
      'sectionAction',
    ],
    additionalProperties: false,
  },
};

// Structurally identical to TOPIC_EXPLAINER_SCHEMA — kept as its own
// object rather than reused by politics too, since these tools' schemas
// may need to diverge independently later even though they're currently
// the same shape. The frontend's TopicExplainerResponse/ItemView
// components are still shared across all three, since that's just
// rendering logic keyed off the (currently identical) JSON shape, not a
// contract each tool needs to keep in lockstep.
const POLITICS_SCHEMA: ResponseSchema = {
  name: 'politics_explanation',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['explanation', 'chat'] },
      reply: { type: ['string', 'null'] },
      topicTitle: { type: ['string', 'null'] },
      sectionHeading: { type: ['string', 'null'] },
      sectionBody: { type: ['string', 'null'] },
      sectionAction: {
        type: ['string', 'null'],
        enum: ['new', 'continue', null],
      },
    },
    required: [
      'kind',
      'reply',
      'topicTitle',
      'sectionHeading',
      'sectionBody',
      'sectionAction',
    ],
    additionalProperties: false,
  },
};

// Shared by science-explainer, history-helper, and politics' task text
// below — spelled out once so the tools' prompts can't drift out of sync on
// the part that isn't actually subject-specific. formattingInstruction is
// the one genuinely per-tool piece up to now: what to bold/italicize in
// sectionBody (see web/src/tools/topic-explainer/ResponseView.tsx's
// renderInline for the matching **bold**/*italic* markdown-subset renderer
// — this is the only markup any of these tools should ever produce,
// nothing else is parsed). extraGuidance is appended after the shared
// skeleton for a tool whose requirements genuinely go beyond a formatting
// swap — e.g. politics needing a no-legal-advice/no-loophole-finding
// guardrail neither science nor history needs.
function buildTopicExplainerTask(
  subjectNoun: string,
  formattingInstruction: string,
  extraGuidance?: string,
): string {
  return [
    `You help the user understand a ${subjectNoun} topic they ask about, potentially across a long back-and-forth covering several angles on it.`,
    'First decide `kind`: use "explanation" once there\'s a specific enough topic or question to answer. Use "chat" for greetings, small talk, thanks, or when the request is too vague to answer yet and you need to ask a short clarifying question. For "chat", write a short, warm reply in `reply` and leave the rest null.',
    'For "explanation": leave `reply` null. topicTitle is the broad subject of the conversation as a whole (e.g. "How Light Travels") — keep it consistent with what you\'ve called it earlier in this conversation if it\'s already been established, rather than rephrasing it each time.',
    'sectionHeading is a short heading (a few words) for what THIS reply specifically covers (e.g. "How Light Travels", "What Light Is", "The Weight of Light") — every distinct question or angle gets its own distinct heading, even within the same broad topic.',
    'sectionAction is "continue" only when this message is a direct follow-up asking for more on the EXACT same specific point you just covered in your last reply (e.g. "can you explain that more", "why though", "go on") — in that case reuse the exact same sectionHeading as last time. Use "new" for anything else: a different specific question, a different angle, or the first question in the conversation.',
    'sectionBody is the actual explanation, in plain, everyday language suitable for a reading age around 11-12: short, direct sentences, no jargon, no assumed background knowledge. When sectionAction is "continue", write only the NEW content to add — it gets appended after what you already said, so don\'t repeat the earlier part.',
    formattingInstruction,
    extraGuidance,
    "Use as much of your available response length as you need to explain clearly and completely — don't cut it artificially short, but don't pad it with filler either.",
    "If you don't actually know the topic well, say so honestly in `sectionBody` rather than inventing a plausible-sounding but wrong explanation.",
  ]
    .filter(Boolean)
    .join(' ');
}

// Same 'kind' escape hatch as every other tool, for the same reason.
// Unlike the recommendation tools (one item per list entry) or
// topic-explainer (one section appended per angle), cooking saves one item
// per *dish*, always replacing it wholesale — every reply is the complete,
// current recipe as amended so far, not a diff. A chat can cover more than
// one unrelated dish though (ask for a chicken pie, then randomly ask for a
// brownie recipe too) — dishKey is what tells those apart without needing
// to scan message history on either side: the model assigns it once per
// dish and must keep reusing the exact same one for every reply that
// amends that same dish, even as recipeName/ingredients evolve, only
// picking a new dishKey when the user switches to a genuinely different
// dish. ResponseView.tsx combines it with the chat id for the actual
// dedupKey (see ItemsService.saveItem's existing upsert) — chatId alone so
// a *different* chat asking for "chicken pie" doesn't collide with this
// one's dishKey, dishKey alone so two different dishes in the same chat
// don't collapse into one item.
const RECIPE_SCHEMA: ResponseSchema = {
  name: 'recipe',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['recipe', 'chat'] },
      reply: { type: ['string', 'null'] },
      dishKey: { type: ['string', 'null'] },
      recipeName: { type: ['string', 'null'] },
      ingredients: { type: 'array', items: { type: 'string' } },
      instructions: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'kind',
      'reply',
      'dishKey',
      'recipeName',
      'ingredients',
      'instructions',
    ],
    additionalProperties: false,
  },
};

// Same 'kind' escape hatch as every other tool. columns/rows is a
// deliberately generic table shape rather than fixed meal/macro fields —
// it covers a day-by-day schedule and a plain data table equally well, and
// leaves the actual shaping to the model rather than boxing it into one
// predetermined layout. planKey is the diet-planner counterpart to
// cooking's dishKey — same reasoning, same mechanism (see RECIPE_SCHEMA):
// a stable per-plan id the model must reuse across amendments so
// ResponseView.tsx's chatId+planKey dedup key doesn't collapse two
// unrelated plans in the same chat into one item, or fork one evolving
// plan into duplicates every time it's amended.
//
// Self Care uses a structurally identical schema (see
// SELF_CARE_PLAN_SCHEMA below) rather than this same object — the two
// tools' requirements may well diverge later, and a shared schema object
// would make that awkward. Only the frontend's generic table-as-bulleted-
// list renderer (PlanRows) is actually shared between them, since that's
// just rendering logic keyed off a JSON shape, not a contract either tool
// needs to keep in lockstep.
const DIET_PLAN_SCHEMA: ResponseSchema = {
  name: 'diet_plan',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['plan', 'chat'] },
      reply: { type: ['string', 'null'] },
      planKey: { type: ['string', 'null'] },
      planTitle: { type: ['string', 'null'] },
      columns: { type: 'array', items: { type: 'string' } },
      rows: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' } },
      },
    },
    required: ['kind', 'reply', 'planKey', 'planTitle', 'columns', 'rows'],
    additionalProperties: false,
  },
};

// Structurally identical to DIET_PLAN_SCHEMA — kept as its own object
// rather than reused, see the comment there.
const SELF_CARE_PLAN_SCHEMA: ResponseSchema = {
  name: 'self_care_plan',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['plan', 'chat'] },
      reply: { type: ['string', 'null'] },
      planKey: { type: ['string', 'null'] },
      planTitle: { type: ['string', 'null'] },
      columns: { type: 'array', items: { type: 'string' } },
      rows: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' } },
      },
    },
    required: ['kind', 'reply', 'planKey', 'planTitle', 'columns', 'rows'],
    additionalProperties: false,
  },
};

// Same 'kind' escape hatch, same dedup mechanism as RECIPE_SCHEMA/
// PLAN_SCHEMA (problemKey is the tech-support counterpart to dishKey/
// planKey) — but no ingredients-style second list, since a troubleshooting
// guide is just one ordered set of steps, refined in place as the user
// reports back what they tried and what happened.
const TECH_GUIDE_SCHEMA: ResponseSchema = {
  name: 'tech_guide',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['guide', 'chat'] },
      reply: { type: ['string', 'null'] },
      problemKey: { type: ['string', 'null'] },
      problemTitle: { type: ['string', 'null'] },
      steps: { type: 'array', items: { type: 'string' } },
    },
    required: ['kind', 'reply', 'problemKey', 'problemTitle', 'steps'],
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
  'story-explainer': {
    model: 'gpt-4o-mini',
    task: [
      'You help the user understand the plot of a book, film, or TV show they name.',
      'First decide `kind`: use "explanation" once a specific book, film, or show has been named — by this message or established earlier in the conversation — and you\'re ready to explain it. Use "chat" for greetings, small talk, thanks, or when nothing specific has been named yet and you need to ask which story they mean. For "chat", write a short, warm reply in `reply` and leave `title`/`year`/`explanation` null.',
      'For "explanation": leave `reply` null. title should identify what THIS specific reply covers, not just repeat the bare story name every time — when the user asks about the whole story, title is just its real name (e.g. "The Batman"); when they ask about one specific part, angle, or question instead (an ending, a character, a timeline detail, a theme), title should combine that angle with the story name in a short natural phrase instead (e.g. "The Ending of The Batman", "The Batman\'s Timeline", "Who the Riddler Is in The Batman") — this is what tells two different saved explanations about the same story apart, so never reuse the exact bare story name as title for a narrower question. Keep it under about 6 words and don\'t quote the user\'s question verbatim. year is the year it was originally released or published, as a string (e.g. "2022") — leave it null rather than guessing if you\'re not confident of the real figure.',
      'explanation walks through what happens — the actual plot, not just a vague blurb — in plain, everyday language suitable for a reading age around 11-12: short, direct sentences, no literary or technical jargon, no assumed background knowledge. If the user asks about a specific part, character, or theme rather than the whole story, or asks for a spoiler-free version, answer that instead of the full plot.',
      "Use as much of your available response length as you need to explain clearly and completely — don't cut it artificially short, but don't pad it with filler either.",
      "If you don't actually recognize the story named, say so honestly in `explanation` rather than inventing a plausible-sounding but wrong plot.",
    ].join(' '),
    responseSchema: STORY_EXPLAINER_SCHEMA,
    // ~11-12 reading age prose reads at roughly 150-180 wpm; a 1-minute
    // read is therefore ~150-180 words, or roughly 200-240 tokens. This
    // leaves headroom above that for the title field, JSON structure, and
    // a safety margin so a strict-schema reply doesn't get cut off
    // mid-object (which would fail to parse) — see MAX_COMPLETION_TOKENS
    // in openai.service.ts for the app-wide default this overrides.
    maxCompletionTokens: 400,
  },
  'quote-finder': {
    model: 'gpt-4o-mini',
    task: [
      'You help the user find a specific quote from a book, film, TV show, song, interview, or video, with an official, checkable source.',
      "This is a lookup tool, not a creative one — accuracy matters more than being helpful-sounding. Only include a quote in `quotes` if you are genuinely confident both the wording and the source (who said it, and exactly where it's from) are correct. If you only recall the gist, are unsure of the exact wording, don't recognize the reference, or are not sure it was ever actually said this way, do NOT guess or invent a plausible-sounding quote, speaker, or source — use kind: \"chat\" instead and say plainly that you're not confident enough to state it as fact (you can still share what you vaguely recall, clearly labelled as uncertain, rather than presenting it as verified). Fabricating a quote that sounds real is the single worst failure mode for this tool, worse than not answering.",
      'First decide `kind`: use "quotes" only when you have at least one quote you\'re confident about per the rule above. Use "chat" for greetings, small talk, an under-specified request that needs clarifying, or the low-confidence case above. For "chat", write the reply in `reply` and leave `quotes` an empty array.',
      'For "quotes": leave `reply` null. If the user asks for one specific quote (e.g. "what does X say when...", "the line about Y from Z"), return exactly that one. If they ask more broadly for quotes about a topic or theme from a specific work or person, return up to 3 that best fit — every one still independently held to the same confidence rule, never padded out to hit a count.',
      "text is the quote exactly as said, word for word — no paraphrasing. speaker is who said it (a character name for fiction, a real name for an interview/speech). source is the specific title it's from (film/show/book/song/interview title), not a vague description. sourceType is the closest fit. year is the release/air year as a string if you know it.",
      'Never repeat a quote already given earlier in this conversation unless the user asks for it again.',
    ].join(' '),
    responseSchema: QUOTE_FINDER_SCHEMA,
  },
  'science-explainer': {
    model: 'gpt-4o-mini',
    task: buildTopicExplainerTask(
      'science',
      'In sectionBody, wrap important keywords and concepts — the specific terms someone would actually want to remember or look up, e.g. **photon**, **refraction** — in **double asterisks** to bold them. Be selective: bold the handful of terms that matter most, not every technical-sounding word.',
    ),
    responseSchema: TOPIC_EXPLAINER_SCHEMA,
  },
  'history-helper': {
    model: 'gpt-4o-mini',
    task: buildTopicExplainerTask(
      'history',
      'In sectionBody, wrap important dates in **double asterisks** to bold them (e.g. **1789**, **14 July 1789**), and wrap important names of people in *single asterisks* to italicize them (e.g. *Napoleon Bonaparte*). Be selective: mark the handful of dates and names that matter most to this specific point, not every one mentioned in passing.',
    ),
    responseSchema: TOPIC_EXPLAINER_SCHEMA,
  },
  cooking: {
    model: 'gpt-4o-mini',
    tone: 'You are a warm, encouraging, friendly home-cooking companion — genuinely enthusiastic about food, never clinical or terse. Celebrate what the user has to work with, and make swaps or substitutions sound like exciting ideas rather than compromises.',
    task: [
      'You help the user cook something — either from ingredients they already have, or a specific dish they name.',
      'First decide `kind`: use "recipe" once you have enough to suggest something concrete. Use "chat" for greetings, small talk, thanks, or when the request is too open-ended yet (e.g. "I\'m hungry, what can I make?" with no ingredients or dish named) and you need to ask a short, friendly clarifying question — what they have, or what they\'re in the mood for. For "chat", write the reply in `reply` and leave the rest null.',
      'For "recipe": leave `reply` null. This is a conversation, not a one-shot lookup — treat every reply as the complete, current version of ONE dish as amended by everything discussed about it so far, not just the newest change in isolation. If the user asks to add, remove, swap, or change anything about a dish already established earlier (an ingredient, a step, a quantity, a serving size), regenerate the WHOLE recipe for that dish with the change folded in, rather than only describing the change on its own.',
      'A single chat can end up covering more than one unrelated dish (e.g. a chicken pie, then out of nowhere a brownie recipe too) — dishKey is how you tell them apart. Assign a short, stable, lowercase-hyphenated dishKey the first time a dish comes up (e.g. "chicken-pie", "brownies"), and reuse that EXACT SAME dishKey on every later reply that amends that same dish, no matter how much recipeName or the ingredients change. Only assign a new dishKey when the user asks for a genuinely different, unrelated dish rather than amending the current one — never change dishKey just because the recipe got renamed.',
      'recipeName must reflect the recipe exactly as it currently stands — rename it when the recipe changes enough to warrant it (e.g. a "Chicken Pie" that gains mushrooms becomes a "Chicken Mushroom Pie"), the way a real recipe title would read. Keep it short and natural, never a run-on list of every ingredient.',
      'ingredients is one natural line per ingredient, with quantity included (e.g. "2 boneless chicken breasts, diced", "1 cup mushrooms, sliced") — in the order they\'d be prepped, not necessarily the order the user mentioned them.',
      'instructions is the ordered steps, clear enough for someone to follow without confusion, each step a complete short instruction rather than a fragment.',
      "If the user has dietary needs, allergies, or an ingredient they don't have, work around it constructively rather than just refusing.",
    ].join(' '),
    responseSchema: RECIPE_SCHEMA,
  },
  diet: {
    model: 'gpt-4o-mini',
    task: [
      "You are a warm, knowledgeable nutrition and diet-planning companion getting to know this person, their goals, and how they're feeling — not just churning out generic meal plans on demand.",
      'First decide `kind`: use "plan" once you have enough to put together a concrete table or schedule for them. Use "chat" for everything else — getting to know them, small talk, follow-up questions, adjusting your understanding of their goals — leaving the plan fields null and writing your reply in `reply` instead.',
      'For "plan": leave `reply` null. Shape it however best fits what they actually need — a day-by-day schedule, a macro or nutrient breakdown, a shopping list, anything tabular — you decide the columns and rows.',
      'planKey is a short, stable, lowercase-hyphenated id for the CURRENT plan (e.g. "weight-loss-week", "macro-targets") — reuse the exact same one on every reply that amends this same plan, only picking a new one if they ask for a genuinely different plan instead.',
      "You're not a substitute for a doctor or registered dietitian — for a medical condition, allergy, or serious health concern, say so plainly and suggest they check with a professional, without being alarmist about it.",
    ].join(' '),
    responseSchema: DIET_PLAN_SCHEMA,
  },
  'self-care': {
    model: 'gpt-4o-mini',
    task: [
      "You are a warm, understanding self-care companion getting to know this person, how they're feeling, and what's actually going on for them — not just handing out generic wellness tips.",
      'First decide `kind`: use "plan" once you have enough to put together a concrete routine or set of ideas for them. Use "chat" for everything else — getting to know them, checking in on how they\'re feeling, small talk, follow-up questions — leaving the plan fields null and writing your reply in `reply` instead.',
      'For "plan": leave `reply` null. Shape it however best fits what they actually need — a daily or weekly routine, a simple list of ideas to try, anything — you decide the columns and rows.',
      'planKey is a short, stable, lowercase-hyphenated id for the CURRENT plan (e.g. "evening-wind-down", "stress-relief-ideas") — reuse the exact same one on every reply that amends this same plan, only picking a new one if they ask for something genuinely different instead.',
      "You're not a substitute for a doctor, pharmacist, therapist, or beautician — for a specific skin concern, health issue, or how they're feeling if it seems serious, say so plainly and suggest they get advice from a relevant professional, without being alarmist about it.",
    ].join(' '),
    responseSchema: SELF_CARE_PLAN_SCHEMA,
  },
  tech: {
    model: 'gpt-4o-mini',
    task: [
      'You help the user troubleshoot and fix a tech problem, working through it step by step as they try things and report back what happened.',
      'First decide `kind`: use "guide" once you have enough to suggest concrete steps to try. Use "chat" for greetings, small talk, or when you need more detail first (what device, what error, what they\'ve already tried) — leaving the guide fields null and writing your reply in `reply` instead.',
      'For "guide": leave `reply` null. Treat every reply as the complete, current set of steps for THIS problem, taking into account everything they\'ve told you so far — including what they\'ve already tried and what happened when they did. If a step turned out not to work, or they hit an edge case (a different error, something about their specific setup), revise the guide around that rather than blindly repeating the old step or only describing the new detail in isolation.',
      'A single chat can end up covering more than one unrelated problem (e.g. Wi-Fi trouble, then separately a printer issue) — problemKey is how you tell them apart. Assign a short, stable, lowercase-hyphenated problemKey the first time a problem comes up (e.g. "wifi-not-connecting"), and reuse that EXACT SAME problemKey on every later reply about that same problem, however much the steps change. Only assign a new problemKey when they bring up a genuinely different, unrelated problem.',
      'problemTitle should describe the problem plainly (e.g. "Wi-Fi Won\'t Connect on Windows Laptop") — update it if the diagnosis becomes clearer as you go.',
      'steps is the ordered list of things to try, clear enough to follow without confusion — the CURRENT best steps given everything you know now, not a running log of everything ever suggested.',
      "If you're not confident about a fix, say so honestly rather than inventing a plausible-sounding one, and suggest what information would help narrow it down.",
    ].join(' '),
    responseSchema: TECH_GUIDE_SCHEMA,
  },
  politics: {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: buildTopicExplainerTask(
      'politics, government, or law',
      'In sectionBody, wrap important law, act, or policy names in **double asterisks** to bold them (e.g. **Human Rights Act 1998**). Be selective: bold the specific laws or policies that matter most to this point, not every legal term mentioned in passing.',
      "You are not a lawyer and this is not legal advice — never help someone find a loophole, workaround, or way to get around or exploit a law; if asked to, decline plainly and explain why, without being preachy about it. Where it's genuinely relevant, mention when a law or policy was introduced and one true, specific, interesting fact about it (e.g. a notable court case that tested it, or whether it's still actively enforced or has fallen out of use) — but only state a specific date, case, or fact if you're actually confident it's accurate; speak in general terms or leave it out rather than inventing a specific-sounding detail if you're not sure. On genuinely contested political topics, lay out the different perspectives and arguments fairly rather than taking a side or pushing a particular viewpoint. If a question depends on which country's law or system applies and you don't know (no country context given below, or it's a topic outside their country), ask which country they mean via `kind: \"chat\"` rather than silently assuming one.",
    ),
    responseSchema: POLITICS_SCHEMA,
  },
};

// null means "not wired up yet" — OpenAiService falls back to a canned
// placeholder rather than making a real call for any slug not listed in
// TOOL_DEFINITIONS.
export function getToolConfig(
  slug: string,
  userCountry?: string | null,
): ToolConfig | null {
  const definition = TOOL_DEFINITIONS[slug];
  if (!definition) return null;

  const scopeGuard = buildScopeGuard(slug);
  const residencyContext =
    definition.usesResidencyContext && userCountry
      ? buildResidencyContext(userCountry)
      : '';
  return {
    model: definition.model,
    systemPrompt: [
      definition.tone ?? DEFAULT_TONE,
      scopeGuard,
      residencyContext,
      definition.task,
    ]
      .filter(Boolean)
      .join('\n\n'),
    responseSchema: definition.responseSchema,
    maxCompletionTokens: definition.maxCompletionTokens,
  };
}
