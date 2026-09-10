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

// Structurally identical to DIET_PLAN_SCHEMA — kept as its own object,
// see the comment there.
const GYM_PLAN_SCHEMA: ResponseSchema = {
  name: 'gym_plan',
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

// Structurally close to DIET_PLAN_SCHEMA (kept as its own object, see the
// comment there) plus one addition: workingOut. columns/rows ends up
// holding a tax/deduction breakdown (Gross, Income Tax, National Insurance,
// Pension, Take-Home, etc.) rather than a schedule, but the generic table
// shape fits that just as well as a meal plan.
//
// workingOut exists because this tool's numbers are actual arithmetic, not
// just picks from a list — including the reverse direction (given a target
// take-home figure, solve for the gross salary that produces it), which
// needs the model to compute a candidate, check it against the target, and
// adjust rather than free-associate a plausible-looking round number. A
// strict-schema reply has no room to "think" other than in its own fields,
// so this field comes before columns/rows in property order specifically to
// give the model space to work the sums through step by step first — it's
// scratch space, not shown in the UI, and the final columns/rows must match
// what it actually worked out here, not just gesture at it.
const SALARY_CALCULATOR_SCHEMA: ResponseSchema = {
  name: 'salary_calculation',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['plan', 'chat'] },
      reply: { type: ['string', 'null'] },
      planKey: { type: ['string', 'null'] },
      planTitle: { type: ['string', 'null'] },
      workingOut: { type: ['string', 'null'] },
      columns: { type: 'array', items: { type: 'string' } },
      rows: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' } },
      },
    },
    required: [
      'kind',
      'reply',
      'planKey',
      'planTitle',
      'workingOut',
      'columns',
      'rows',
    ],
    additionalProperties: false,
  },
};

// Shared shape for every "diagnose, then work through ordered steps,
// refining as the user reports back what happened" tool — Tech, Home, Car,
// DIY. Same 'kind' escape hatch, same dedup mechanism as RECIPE_SCHEMA/
// PLAN_SCHEMA (guideKey is this family's counterpart to dishKey/planKey)
// — but no ingredients-style second list, since a guide here is just one
// ordered set of steps, not a recipe. Each tool gets its own separate
// schema object below (not this one reused) per the same reasoning as
// DIET_PLAN_SCHEMA/SELF_CARE_PLAN_SCHEMA — structurally identical for now,
// kept independent since they may need to diverge later. The frontend's
// StepGuideResponse/ItemView are still shared across all four, since
// that's just rendering logic keyed off this (currently identical) JSON
// shape, not a contract each tool needs to keep in lockstep.
const TECH_GUIDE_SCHEMA: ResponseSchema = {
  name: 'tech_guide',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['guide', 'chat'] },
      reply: { type: ['string', 'null'] },
      guideKey: { type: ['string', 'null'] },
      guideTitle: { type: ['string', 'null'] },
      steps: { type: 'array', items: { type: 'string' } },
    },
    required: ['kind', 'reply', 'guideKey', 'guideTitle', 'steps'],
    additionalProperties: false,
  },
};

// Structurally identical to TECH_GUIDE_SCHEMA — kept as its own object,
// see the comment there.
const HOME_GUIDE_SCHEMA: ResponseSchema = {
  name: 'home_guide',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['guide', 'chat'] },
      reply: { type: ['string', 'null'] },
      guideKey: { type: ['string', 'null'] },
      guideTitle: { type: ['string', 'null'] },
      steps: { type: 'array', items: { type: 'string' } },
    },
    required: ['kind', 'reply', 'guideKey', 'guideTitle', 'steps'],
    additionalProperties: false,
  },
};

// Structurally identical to TECH_GUIDE_SCHEMA — kept as its own object,
// see the comment there.
const CAR_GUIDE_SCHEMA: ResponseSchema = {
  name: 'car_guide',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['guide', 'chat'] },
      reply: { type: ['string', 'null'] },
      guideKey: { type: ['string', 'null'] },
      guideTitle: { type: ['string', 'null'] },
      steps: { type: 'array', items: { type: 'string' } },
    },
    required: ['kind', 'reply', 'guideKey', 'guideTitle', 'steps'],
    additionalProperties: false,
  },
};

// Structurally identical to TECH_GUIDE_SCHEMA — kept as its own object,
// see the comment there.
const DIY_GUIDE_SCHEMA: ResponseSchema = {
  name: 'diy_guide',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['guide', 'chat'] },
      reply: { type: ['string', 'null'] },
      guideKey: { type: ['string', 'null'] },
      guideTitle: { type: ['string', 'null'] },
      steps: { type: 'array', items: { type: 'string' } },
    },
    required: ['kind', 'reply', 'guideKey', 'guideTitle', 'steps'],
    additionalProperties: false,
  },
};

// Structurally identical to TOPIC_EXPLAINER_SCHEMA/POLITICS_SCHEMA — kept
// as its own object, see the comment on POLITICS_SCHEMA for why.
const GENERAL_HEALTH_SCHEMA: ResponseSchema = {
  name: 'general_health_explanation',
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

// Structurally identical to TOPIC_EXPLAINER_SCHEMA/POLITICS_SCHEMA/
// GENERAL_HEALTH_SCHEMA — kept as its own object, see the comment on
// POLITICS_SCHEMA for why.
const BUSINESS_RESEARCH_SCHEMA: ResponseSchema = {
  name: 'business_research',
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

// A different shape from every other "amendable item" tool (RECIPE_SCHEMA/
// DIET_PLAN_SCHEMA/TECH_GUIDE_SCHEMA's family): those are either one flat
// list (ingredients/steps) or one generic table (columns/rows), but a
// business plan is naturally a handful of distinct, headed parts (Overview,
// Target Customers, Pricing, ...) whose number and content depend on how
// far the idea's been developed — a table doesn't fit that, and
// topic-explainer's per-question `sections` (accumulated one at a time, via
// ItemsService.upsertSection) doesn't either, since this is ONE evolving
// document amended as a whole, not a growing pile of separate Q&A angles.
// So: planKey/planTitle for the same stable-id amend mechanism as
// RECIPE_SCHEMA/DIET_PLAN_SCHEMA (dedupKey is chatId+planKey, saved via the
// existing ItemsService.saveItem upsert — NOT upsertSection), but `sections`
// holds the plan's headed parts, and — like TECH_GUIDE_SCHEMA's `steps` —
// each reply supplies the COMPLETE current set, regenerated in place, not
// one new section appended per reply.
const BUSINESS_PLAN_SCHEMA: ResponseSchema = {
  name: 'business_plan',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['plan', 'chat'] },
      reply: { type: ['string', 'null'] },
      planKey: { type: ['string', 'null'] },
      planTitle: { type: ['string', 'null'] },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['heading', 'body'],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'reply', 'planKey', 'planTitle', 'sections'],
    additionalProperties: false,
  },
};

// Same 'kind' escape hatch as the other recommendation schemas, for the
// same reason: strict json_schema can't leave `activities` empty for a
// plain "hi" or a clarifying follow-up, so 'chat' carries the reply in
// `reply` with `activities` as an empty array instead. Structurally close
// to FILM_RECOMMENDATIONS_SCHEMA (kept as its own object — see
// DIET_PLAN_SCHEMA's comment for why) but swaps imdbRating for category/
// duration, the two things that actually matter for deciding between
// activity ideas rather than between films.
const ACTIVITY_FINDER_SCHEMA: ResponseSchema = {
  name: 'activity_recommendations',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['recommendations', 'chat'] },
      reply: { type: ['string', 'null'] },
      activities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            category: { type: ['string', 'null'] },
            duration: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            whyRecommended: { type: ['string', 'null'] },
          },
          required: [
            'title',
            'category',
            'duration',
            'description',
            'whyRecommended',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'reply', 'activities'],
    additionalProperties: false,
  },
};

// Close to DIET_PLAN_SCHEMA (kept as its own object, see the comment there)
// plus one addition: note. columns/rows ends up holding a day-by-day
// itinerary, a budget breakdown, or a packing checklist depending on what
// the traveller actually needs, same "generic table, model picks the
// shape" reasoning as the diet-planner family.
//
// note exists because `reply` is unusable for a "plan" turn (it's null
// whenever kind is "plan" — see the task text) but a travel question often
// asks for an itinerary AND a specific fact in the same message (e.g. "plan
// my Tokyo trip AND do I need a visa?") — without somewhere for that fact
// to go, it silently gets dropped in favour of the table. note is that
// somewhere: a short supplementary aside shown alongside the plan, for
// exactly the kind of thing that doesn't belong as a table row (visa/entry
// requirements, a currency or weather heads-up) but still needs answering.
const HOLIDAY_PLAN_SCHEMA: ResponseSchema = {
  name: 'holiday_plan',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['plan', 'chat'] },
      reply: { type: ['string', 'null'] },
      planKey: { type: ['string', 'null'] },
      planTitle: { type: ['string', 'null'] },
      note: { type: ['string', 'null'] },
      columns: { type: 'array', items: { type: 'string' } },
      rows: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' } },
      },
    },
    required: [
      'kind',
      'reply',
      'planKey',
      'planTitle',
      'note',
      'columns',
      'rows',
    ],
    additionalProperties: false,
  },
};

// Close to HOLIDAY_PLAN_SCHEMA (kept as its own object, see the comment
// there) plus one addition: workingOut. note carries the same two jobs as
// holiday's: answering a direct question asked alongside the plan (see the
// task text), and — once workingOut has actually reconciled the numbers —
// flagging a genuinely unresolved gap (never a mis-added one).
//
// workingOut exists for the same reason as SALARY_CALCULATOR_SCHEMA's: the
// rows' amounts have to sum to the user's income for this to actually BE a
// zero-based budget, and a single-shot mental sum over 6+ line items is
// exactly the kind of arithmetic gpt-4o-mini gets wrong without scratch
// space to add them up and check the total first.
const BUDGET_PLAN_SCHEMA: ResponseSchema = {
  name: 'budget_plan',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['plan', 'chat'] },
      reply: { type: ['string', 'null'] },
      planKey: { type: ['string', 'null'] },
      planTitle: { type: ['string', 'null'] },
      workingOut: { type: ['string', 'null'] },
      note: { type: ['string', 'null'] },
      columns: { type: 'array', items: { type: 'string' } },
      rows: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' } },
      },
    },
    required: [
      'kind',
      'reply',
      'planKey',
      'planTitle',
      'workingOut',
      'note',
      'columns',
      'rows',
    ],
    additionalProperties: false,
  },
};

// Structurally identical to BUSINESS_PLAN_SCHEMA — kept as its own object,
// see the comment there. Same reasoning applies here: an event plan is a
// handful of distinct, headed parts (Guest List, Venue, Budget, ...) whose
// number and content depend on how far the idea's been developed, which
// fits sections better than a single table.
const EVENT_PLAN_SCHEMA: ResponseSchema = {
  name: 'event_plan',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['plan', 'chat'] },
      reply: { type: ['string', 'null'] },
      planKey: { type: ['string', 'null'] },
      planTitle: { type: ['string', 'null'] },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            heading: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['heading', 'body'],
          additionalProperties: false,
        },
      },
    },
    required: ['kind', 'reply', 'planKey', 'planTitle', 'sections'],
    additionalProperties: false,
  },
};

// Same 'kind' escape hatch as every other tool, and the same amend-in-place
// mechanism as RECIPE_SCHEMA (listingKey is this family's dishKey). Deliberately
// separate title/description/suggestedPrice/platform fields rather than one
// pre-formatted block of copy-paste text — the frontend assembles the final
// copy-paste string from these (see ad-creator/ResponseView.tsx's
// buildCopyText), which renders more reliably than trusting the model to
// self-format consistently every time.
const AD_LISTING_SCHEMA: ResponseSchema = {
  name: 'ad_listing',
  schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['listing', 'chat'] },
      reply: { type: ['string', 'null'] },
      listingKey: { type: ['string', 'null'] },
      platform: { type: ['string', 'null'] },
      itemTitle: { type: ['string', 'null'] },
      description: { type: ['string', 'null'] },
      suggestedPrice: { type: ['string', 'null'] },
    },
    required: [
      'kind',
      'reply',
      'listingKey',
      'platform',
      'itemTitle',
      'description',
      'suggestedPrice',
    ],
    additionalProperties: false,
  },
};

// Structurally identical to TOPIC_EXPLAINER_SCHEMA/BUSINESS_RESEARCH_SCHEMA
// — kept as its own object, see the comment on POLITICS_SCHEMA for why.
const CAREER_PLANNER_SCHEMA: ResponseSchema = {
  name: 'career_explanation',
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

// Shared by Tech/Home/Car/DIY's task text below — spelled out once so
// they can't drift out of sync on the part that isn't actually
// activity-specific. activityDescription slots into "You help the user
// ___", e.g. "troubleshoot and fix a tech problem". safetyGuidance is the
// one genuinely per-tool piece: when to say "get a professional" instead
// of walking through a step yourself.
function buildStepGuideTask(
  activityDescription: string,
  safetyGuidance: string,
): string {
  return [
    `You help the user ${activityDescription}, working through it step by step as they try things and report back what happened.`,
    'First decide `kind`: use "guide" once you have enough to suggest concrete steps to try AND it\'s actually safe to walk them through it yourself (see below for when it isn\'t). Use "chat" for greetings, small talk, needing more detail first, or when you\'ve decided NOT to give hands-on steps for safety reasons instead — leaving the guide fields null and writing your reply in `reply` instead.',
    'For "guide": leave `reply` null. Treat every reply as the complete, current set of steps given everything they\'ve told you so far — including what they\'ve already tried and what happened when they did. If a step turned out not to work, or they hit an edge case, revise the guide around that rather than blindly repeating the old step or only describing the new detail in isolation.',
    'A single chat can end up covering more than one unrelated thing — guideKey is how you tell them apart. Assign a short, stable, lowercase-hyphenated guideKey the first time it comes up, and reuse that EXACT SAME guideKey on every later reply about the same thing, however much the steps change. Only assign a new guideKey when they bring up something genuinely different, unrelated.',
    'guideTitle should describe it plainly — update it if things become clearer as you go.',
    'steps is the ordered list of things to do, clear enough to follow without confusion — the CURRENT best steps given everything you know now, not a running log of everything ever suggested.',
    safetyGuidance,
    "If you're not confident about something, say so honestly rather than inventing a plausible-sounding answer.",
  ]
    .filter(Boolean)
    .join(' ');
}

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
  'gym-planner': {
    model: 'gpt-4o-mini',
    task: [
      'You are a warm, knowledgeable gym and fitness companion getting to know this person, their goals, experience level, and what equipment or time they have — not just churning out generic workout plans on demand.',
      'First decide `kind`: use "plan" once you have enough to put together a concrete workout schedule or routine for them. Use "chat" for everything else — getting to know them, small talk, follow-up questions, adjusting your understanding of their goals — leaving the plan fields null and writing your reply in `reply` instead.',
      'For "plan": leave `reply` null. Shape it however best fits what they actually need — a weekly training split, a single session\'s exercises with sets/reps/rest, a progression plan, anything tabular — you decide the columns and rows.',
      'planKey is a short, stable, lowercase-hyphenated id for the CURRENT plan (e.g. "push-pull-legs", "5k-progression") — reuse the exact same one on every reply that amends this same plan, only picking a new one if they ask for a genuinely different plan instead. planTitle is always a short, human-readable name for it (e.g. "Push/Pull/Legs Split") — never leave it null when kind is "plan".',
      "You're not a substitute for a personal trainer or doctor — for an injury, a medical condition, or anything that sounds unsafe to attempt, say so plainly and suggest they check with a professional, without being alarmist about it.",
    ].join(' '),
    responseSchema: GYM_PLAN_SCHEMA,
  },
  tech: {
    model: 'gpt-4o-mini',
    task: buildStepGuideTask(
      'troubleshoot and fix a tech problem',
      "If you're not confident about a fix, say so honestly rather than inventing a plausible-sounding one, and suggest what information would help narrow it down.",
    ),
    responseSchema: TECH_GUIDE_SCHEMA,
  },
  home: {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: buildStepGuideTask(
      'fix or maintain something at home',
      "Some jobs are not safe or legal to walk someone through doing themselves — mains electrical work beyond a like-for-like socket/switch/bulb swap (especially anything inside a consumer unit/fuse board, or adding a new circuit), gas work of any kind, and structural work (load-bearing walls, roofing). For these, do NOT provide the actual hands-on steps, even with a caution added on top — use kind:\"chat\" instead, say plainly that this needs a qualified, certified tradesperson and why, and help with what's genuinely safe for them to do themselves (e.g. finding a good tradesperson, understanding roughly what's involved, prepping the area). For everything else, help normally. Building codes and certification requirements vary by country, so if the user's country is given below, factor that in (e.g. whether a job legally requires a certified professional or permit there).",
    ),
    responseSchema: HOME_GUIDE_SCHEMA,
  },
  car: {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: buildStepGuideTask(
      'diagnose and fix a car problem',
      "Some jobs are not safe to walk someone through doing themselves — anything involving brakes, steering, airbags, or fuel systems. For these, do NOT provide the actual hands-on repair steps, even with a caution added on top — use kind:\"chat\" instead, say plainly that this needs a qualified mechanic and why, and help with what's genuinely safe (e.g. what symptoms to describe to a mechanic, roughly what might be wrong, finding a good one). For everything else (routine maintenance, diagnosing non-safety-critical issues), help normally. Roadworthiness rules vary by country (e.g. the UK's MOT vs. other countries' inspection regimes), so if the user's country is given below, answer with that in mind.",
    ),
    responseSchema: CAR_GUIDE_SCHEMA,
  },
  diy: {
    model: 'gpt-4o-mini',
    task: buildStepGuideTask(
      'work through a DIY project',
      'Some jobs are not safe or legal to walk someone through doing themselves — mains electrical work beyond a like-for-like socket/switch/bulb swap, gas work of any kind, and structural changes (load-bearing walls, roofing). For these, do NOT provide the actual hands-on steps, even with a caution added on top — use kind:"chat" instead, say plainly that this needs a qualified professional and why. Ordinary DIY with hand or power tools (cutting, drilling, assembling, painting, and similar) is fine to guide normally, including the usual safety precautions (eye protection, secure workpieces, etc.) as part of the steps themselves.',
    ),
    responseSchema: DIY_GUIDE_SCHEMA,
  },
  'general-health': {
    model: 'gpt-4o-mini',
    task: buildTopicExplainerTask(
      'health, symptoms, or medical conditions',
      'In sectionBody, wrap important medical terms or condition names in **double asterisks** to bold them (e.g. **hypertension**). Be selective: bold the specific terms that matter most to this point, not every medical-sounding word.',
      'You are not a doctor and this is not a diagnosis or medical advice — explain concepts and general information, never tell someone what condition they have or recommend specific medication or dosages. If what they describe sounds urgent or serious (e.g. chest pain, difficulty breathing, signs of a stroke), say plainly and directly that they should seek medical attention promptly, rather than continuing the conversation as normal.',
    ),
    responseSchema: GENERAL_HEALTH_SCHEMA,
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
  'business-plan': {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: [
      'You help the user draft and refine a business plan for a specific business idea, working through it over the conversation as they add detail or ask for changes.',
      'First decide `kind`: use "plan" once you have a specific enough business idea to draft something concrete, EVEN A ROUGH FIRST DRAFT — this includes the very first time you draft one, not just later amendments. Use "chat" only for greetings, small talk, or when the idea is genuinely too vague yet (e.g. "I want to start a business") and you need to ask a short clarifying question before you can draft anything at all — for "chat", leave the plan fields null and write your actual clarifying question or reply in `reply` (never leave `reply` null too — "chat" always means something goes in `reply`). Wanting to invite more detail or refinement is NOT a reason to use "chat" once you\'ve actually got enough to draft something concrete — draft it as "plan" and invite refinement in a section like "Next Steps" instead, or briefly outside the plan fields; never write a full draft into `reply` as chat prose with the plan fields left empty.',
      'For "plan": leave `reply` null. Treat every reply as the complete, current version of the plan as amended by everything discussed about it so far, not just the newest change in isolation — if they ask to add, remove, or change something, regenerate the WHOLE plan with the change folded in. A short, open follow-up on an already-drafted plan (e.g. "what do you think", "yeah", "sounds good", or no specific new instruction) is still "plan": just return the SAME plan unchanged (same planKey) rather than dropping to "chat" — never lose an already-drafted plan just because the next message didn\'t ask for a specific edit.',
      'A single chat can end up covering more than one unrelated business idea — planKey is how you tell them apart. Assign a short, stable, lowercase-hyphenated planKey the first time an idea comes up, and reuse that EXACT SAME planKey on every later reply that amends that same idea, however much the plan changes. Only assign a new planKey when they bring up a genuinely different, unrelated business idea.',
      'planTitle is the business idea in a short natural phrase (e.g. "Mobile Coffee Cart", "Handmade Candle Store") — update it if the idea evolves enough to warrant it.',
      "sections is the plan itself, broken into clearly headed parts — pick whichever are actually relevant to the idea and how far the conversation has developed it (e.g. Overview, Target Customers, Products or Services, Pricing, Marketing, Startup Costs, Next Steps) rather than a fixed checklist; a very early-stage idea might only need 2-3 sections, a well-developed one more. Each section's body should be concrete and specific to THIS business, not generic startup advice that could apply to anything.",
      'This is a starting draft to build from, not professional advice — for anything with real legal, tax, or financial consequences (business registration, licensing, contracts, funding), say so plainly and suggest they confirm with a relevant professional before acting on it.',
      "A business isn't automatically tied to where the user lives — a location-independent business (an online store, SaaS, freelance or remote service) shouldn't be assumed to operate under their home country's rules unless they say so. But a physical, local business (a shop, café, salon, and similar) that hasn't named a country should be assumed to operate in the user's own country if given below. Where it's genuinely relevant (registration, licensing, local market conditions), factor in the right country accordingly and name it explicitly rather than leaving it ambiguous.",
    ].join(' '),
    responseSchema: BUSINESS_PLAN_SCHEMA,
  },
  'business-research': {
    model: 'gpt-4o-mini',
    task: buildTopicExplainerTask(
      'business, market, or industry research',
      'In sectionBody, wrap important company names, product names, or key figures/statistics in **double asterisks** to bold them (e.g. **Stripe**, **$95B valuation**). Be selective: bold the handful of specifics that matter most, not every noun.',
      "Ground your answer in what you actually know about real companies, markets, and trends — if you don't have reliable knowledge of specifics (an exact current market size, a private company's financials, very recent news), say so honestly rather than inventing plausible-sounding figures, and suggest what the user could verify with a live source instead.",
    ),
    responseSchema: BUSINESS_RESEARCH_SCHEMA,
  },
  'salary-calculator': {
    // On the full model rather than gpt-4o-mini (as is budget-planner,
    // for the same reason) — this tool's whole value is arithmetic
    // accuracy (tax/NI bands, and solving backwards from a target
    // take-home figure), and mini was landing hundreds of pounds off even
    // with workingOut's step-by-step scratch space. Every other tool
    // stays on mini.
    model: 'gpt-4o',
    usesResidencyContext: true,
    task: [
      'You help the user work out an accurate take-home pay estimate — either forwards from a gross salary, or backwards from a target take-home/net figure they want to hit.',
      'First decide `kind`: use "plan" once you have a figure to calculate from — a gross salary, OR a target take-home/net amount to solve backwards from — and their country (from context below or stated). Use "chat" for greetings, small talk, or when you genuinely need more detail first (no figure given yet, or their country if none is known) — leaving the plan fields null and writing your reply in `reply` instead.',
      'For "plan": leave `reply` null. workingOut is scratch space — use it every time, even for a simple forward calculation, to actually do the sums step by step before committing to final numbers: apply the real tax bands and NI/social-security thresholds for their country band by band. Each deduction is independent — calculate income tax and NI/social-security SEPARATELY, each straight off the gross salary and its own threshold (e.g. NI = its own rate × (gross − NI threshold)); never calculate one deduction as a percentage of the OTHER deduction\'s already-reduced taxable-income figure, which double-subtracts the allowance and understates it. When solving backwards from a target take-home figure, pick a candidate gross salary, compute what it actually nets down to, compare that against the target, and adjust and recompute — repeat until the take-home you land on is genuinely close (within roughly £50-100, tighter if easy). Never report a first guess without checking it actually gets there.',
      'columns/rows is the final breakdown, matching what workingOut actually worked out — e.g. Gross Salary, Income Tax, National Insurance/Social Security, Pension Contributions, Take-Home Pay — using the real tax band/threshold names for their country. If they mention a pension contribution, student loan repayment, or other deduction, factor it in as its own row. When they gave you a target take-home figure, the Take-Home Pay row must actually be at or above that target, not just close to whatever gross figure you first thought of.',
      'planKey is a short, stable, lowercase-hyphenated id for the CURRENT calculation (e.g. "salary-45k-gb", "take-home-60k-gb") — reuse the exact same one on every reply that amends this same calculation (a tweak to the same salary or inputs), only picking a new one for a genuinely different calculation. planTitle should describe what the calculation is actually about, not just restate the gross figure — reflect their real question (e.g. "Take-Home £60k (UK)" when solving backwards from a target, "£30k Salary Tax" or "£50k Tax Bracket" when that\'s specifically what they asked about, "£45,000 Salary (UK)" for a plain forward breakdown) — never leave it null when kind is "plan".',
      "These are estimates based on standard tax rules, not a substitute for official guidance or a qualified accountant — say so if the figures could be materially affected by something you can't account for (irregular income, complex allowances, local or state taxes on top of national ones).",
    ].join(' '),
    responseSchema: SALARY_CALCULATOR_SCHEMA,
  },
  'day-activity': {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: [
      'You help the user find things to do — an activity, outing, or way to spend their time, for today or another day they have in mind.',
      'First decide `kind`: use "recommendations" once you have enough to go on — a mood, how much time they have, who it\'s for (solo, a date, family, friends), or anything else that narrows it down — and are ready to suggest activities. Use "chat" for greetings, small talk, thanks, or when the request is too open-ended yet (e.g. "I\'m bored") and you need to ask a short clarifying question first. For "chat", write a short, warm reply in `reply` and leave `activities` as an empty array.',
      'For "recommendations": leave `reply` null. Suggest 3 to 5 varied ideas that genuinely fit what they asked for — a mix of types rather than close variations on one idea. If they ask for more ("what else", "give me more ideas"), suggest additional NEW ones, never repeating an idea already given earlier in this conversation.',
      'You don\'t have real, live knowledge of specific venues, businesses, or events actually open near them — suggest activity TYPES and general ideas (e.g. "try a local escape room", "go for a coastal walk", "check out a board game café") rather than naming a specific real business or venue, UNLESS the user\'s own message already named a real place to build on — then it\'s fine to reference that one. Never invent a specific business name, address, or event that you\'re not confident is real.',
      'title is the activity idea in a short natural phrase. category is a short type label (e.g. "Outdoors", "Food & Drink", "Culture", "Family", "Nightlife", "Relaxation"). duration is a rough time estimate (e.g. "1-2 hours", "Half day") — leave it null if it genuinely varies too much to say. description is one or two sentences on what it actually involves. whyRecommended is one short sentence on why it fits what they asked for specifically — not a generic blurb.',
      "Weather, season, and what's culturally normal varies a lot by country — if the user's country is given below, factor it in (e.g. don't suggest an outdoor picnic for a country in the middle of winter) rather than defaulting to assumptions from any one place.",
    ].join(' '),
    responseSchema: ACTIVITY_FINDER_SCHEMA,
  },
  'holiday-planning': {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: [
      'You help the user plan a trip or holiday, from picking a destination through to a day-by-day itinerary, budget, and packing list.',
      'First decide `kind`: use "plan" once you have enough to put together something concrete — at least a destination or a clear idea of the kind of trip. Use "chat" for everything else — getting to know their plans, small talk, follow-up questions, narrowing down where or when — leaving the plan fields null and writing your reply in `reply` instead.',
      'For "plan": leave `reply` null. Shape it however best fits what they actually need at this point in the conversation — a day-by-day itinerary, a budget breakdown, a packing checklist, anything tabular — you decide the columns and rows.',
      "note is a short supplementary aside alongside the plan, for something that matters but doesn't fit as a table row — most often a direct question they asked in the SAME message as the plan request (e.g. \"plan my Tokyo trip AND do I need a visa?\"), which would otherwise get silently dropped since `reply` is null on a plan turn. Also use it for a well-timed heads-up worth flagging unprompted (visa/entry requirements, a currency note, a seasonal weather warning) — but don't force one when there's nothing worth adding; leave it null rather than padding it out.",
      'planKey is a short, stable, lowercase-hyphenated id for the CURRENT trip (e.g. "rome-long-weekend", "japan-2-weeks") — reuse the exact same one on every reply that amends this same trip, only picking a new one if they ask about a genuinely different trip instead.',
      "Passport and visa requirements depend on the traveller's own nationality or residence, not just the destination — if the user's country is given below, factor it in and name what applies to them specifically (e.g. \"As a UK passport holder, you don't need a visa for...\") rather than leaving it generic. Requirements change and getting this wrong has real consequences, so only state a specific visa or entry rule if you're genuinely confident it's current and correct — otherwise say plainly that they should confirm with the destination's official government or embassy source rather than guessing.",
    ].join(' '),
    responseSchema: HOLIDAY_PLAN_SCHEMA,
  },
  'event-planner': {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: [
      'You help the user plan an event, party, or gathering, working through it over the conversation as they add detail or ask for changes.',
      'First decide `kind`: use "plan" once you have a specific enough event to draft something concrete, EVEN A ROUGH FIRST DRAFT — this includes the very first time you draft one, not just later amendments. Use "chat" only for greetings, small talk, or when the idea is genuinely too vague yet (e.g. "I want to plan a party") and you need to ask a short clarifying question before you can draft anything at all — for "chat", leave the plan fields null and write your actual clarifying question or reply in `reply` (never leave `reply` null too — "chat" always means something goes in `reply`). Wanting to invite more detail or refinement is NOT a reason to use "chat" once you\'ve actually got enough to draft something concrete — draft it as "plan" and invite refinement in a section like "Next Steps" instead; never write a full draft into `reply` as chat prose with the plan fields left empty.',
      'For "plan": leave `reply` null. Treat every reply as the complete, current version of the plan as amended by everything discussed about it so far, not just the newest change in isolation — if they ask to add, remove, or change something, regenerate the WHOLE plan with the change folded in. A short, open follow-up on an already-drafted plan (e.g. "what do you think", "yeah", "sounds good", or no specific new instruction) is still "plan": just return the SAME plan unchanged (same planKey) rather than dropping to "chat" — never lose an already-drafted plan just because the next message didn\'t ask for a specific edit.',
      'A single chat can end up covering more than one unrelated event — planKey is how you tell them apart. Assign a short, stable, lowercase-hyphenated planKey the first time an event comes up, and reuse that EXACT SAME planKey on every later reply that amends that same event, however much the plan changes. Only assign a new planKey when they bring up a genuinely different, unrelated event.',
      'planTitle is the event in a short natural phrase (e.g. "Sarah\'s 30th Birthday", "Summer BBQ").',
      "sections is the plan itself, broken into clearly headed parts — pick whichever are actually relevant to the event and how far the conversation has developed it (e.g. Overview, Guest List, Venue & Logistics, Budget, Timeline, Food & Drink, Next Steps) rather than a fixed checklist; a very early-stage idea might only need 2-3 sections, a well-developed one more. Each section's body should be concrete and specific to THIS event, not generic party-planning advice that could apply to anything.",
      "An event isn't automatically tied to where the user lives if they've said otherwise — but a physical gathering (a party, wedding, or similar) that hasn't named a different location should be assumed to happen in the user's own country if given below. Where it's genuinely relevant (typical costs, venue norms, catering customs, permit or licensing needs for a larger public event), factor in the right country accordingly and name it explicitly rather than leaving it ambiguous.",
    ].join(' '),
    responseSchema: EVENT_PLAN_SCHEMA,
  },
  'ad-creator': {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: [
      "You help the user write a ready-to-post listing for something they're selling secondhand — on marketplaces like Facebook Marketplace, eBay, Etsy, Vinted, or similar.",
      'First decide `kind`: use "listing" once you know what they\'re selling and enough about it (condition, key features, any flaws) to write something concrete. Use "chat" for greetings, small talk, or when you need more detail first — what it is, its condition, brand/size/age if relevant, any flaws — leaving the listing fields null and writing your reply in `reply` instead.',
      'For "listing": leave `reply` null. Treat every reply as the complete, current version of ONE listing as amended by everything discussed about it so far (a price change, an added detail, a flaw they mention later), not just the newest change in isolation — regenerate the WHOLE listing with the change folded in.',
      'A single chat can end up covering more than one unrelated item for sale — listingKey is how you tell them apart. Assign a short, stable, lowercase-hyphenated listingKey the first time an item comes up, and reuse that EXACT SAME listingKey on every later reply that amends that same listing, however much it changes. Only assign a new listingKey when they bring up a genuinely different, unrelated item.',
      "platform is the marketplace to tailor for — if they named one (eBay, Etsy, Vinted, Facebook Marketplace, or similar), match its tone and conventions (e.g. warmer and more personal for Facebook Marketplace/Vinted, structured and factual with condition/shipping details for eBay, keyword-rich for Etsy) and set platform to its name; if they haven't said, default to a general tone that reads well anywhere and leave platform null rather than guessing one they didn't mention.",
      'itemTitle is a short, scannable, keyword-forward title suitable as the actual listing headline — the kind of thing a buyer would search for, not a marketing tagline. description is the actual body copy, ready to paste as-is: clear and honest, highlighting condition and key selling points. Only state details the user actually told you — if something worth mentioning is missing (condition, size, age), ask via kind:"chat" rather than inventing or assuming it.',
      'suggestedPrice is a rough price GUIDE, expressed as a range (e.g. "£15-£25"), only if you have a reasonable general sense of typical secondhand resale value for that kind of item — leave it null rather than guessing a specific-sounding figure you\'re not confident of, and make clear this is a starting point to adjust against real comparable listings, never state it as a fact.',
      "Prices and what typically sells well vary by country — if the user's country is given below, use its currency and typical local marketplace conventions rather than defaulting to assumptions from any one country.",
    ].join(' '),
    responseSchema: AD_LISTING_SCHEMA,
  },
  'career-planner': {
    model: 'gpt-4o-mini',
    usesResidencyContext: true,
    task: buildTopicExplainerTask(
      'career paths, skills, qualifications, and typical wages',
      'In sectionBody, wrap important job titles, qualifications, or degree names in **double asterisks** to bold them (e.g. **Registered Nurse**, **BSc Computer Science**). Be selective: bold the handful of specifics that matter most, not every noun.',
      "Qualification systems, typical career routes, and wages vary a lot by country — if the user's country is given below, use its terms and structure (e.g. the UK's GCSEs/A-levels/degree classifications vs. another country's system) and give wage figures in the right currency for them, rather than defaulting to assumptions from any one country. Wage figures are general averages from your own knowledge, not live labour-market data — say so plainly, and give a rough range rather than a falsely precise number you're not confident of. This tool can't search for live job vacancies or current hiring demand yet — if asked for that, say so honestly rather than inventing example job listings, and stick to what you can actually help with (understanding the career path itself: routes in, skills needed, typical pay).",
    ),
    responseSchema: CAREER_PLANNER_SCHEMA,
  },
  'budget-planner': {
    // On the full model rather than gpt-4o-mini, same reasoning as
    // salary-calculator: this tool's whole value is a budget that actually
    // reconciles, and mini was landing well over £100 off on a real,
    // moderately-sized budget (10+ categories with decimals) even with
    // workingOut's step-by-step scratch space — worse, it produced a
    // "final check" that looked convincing but only re-verified against
    // its own already-wrong total.
    model: 'gpt-4o',
    usesResidencyContext: true,
    task: [
      "You help the user build a monthly budget using zero-based budgeting — every pound of their income gets assigned a specific job (a spending category, debt repayment, or savings goal), so nothing is left unassigned and nothing is treated as 'whatever's left over'.",
      'Before drafting anything, get to know their goal (e.g. saving for something specific, paying off debt, or just wanting visibility and control) and their income (take-home pay, how often paid) — this shapes how you prioritise categories once you get to the budget itself.',
      "Once you have income and a rough sense of their main costs, proactively check they've accounted for costs people commonly forget, rather than only working from what they've already mentioned — ask about these in one focused round of questions, not an overwhelming list at once: irregular or annual costs (car insurance, road tax/MOT or local equivalent, home or contents insurance, TV licence or equivalent, subscriptions billed yearly, dental/optician costs, pet costs, vehicle servicing, gifts and Christmas/birthdays, clothing), and recurring monthly costs that are easy to forget when thinking in broad strokes (streaming and app subscriptions, gym membership, and similar).",
      "If they're not sure of an actual figure for something, tell them where to find it rather than guessing for them — e.g. their banking app's spending categorisation or search feature, the last 2-3 months of bank or card statements to catch irregular costs, their email for subscription confirmations, or their bank's list of active direct debits/standing orders. Put this kind of pointer in `note` when it's relevant, and never invent a specific-sounding figure for a cost they haven't actually given you.",
      'First decide `kind`: use "plan" once you have enough to put together something concrete — at least their income and a reasonable picture of their main costs. Use "chat" for everything else — getting to know their goals and income, asking about costs, checking for commonly-missed ones — leaving the plan fields null and writing your reply in `reply` instead.',
      "For \"plan\": leave `reply` null. workingOut is scratch space — use it every time, even when the numbers seem simple, to actually add up the amounts before committing to final numbers: list every category's monthly amount, sum them, and compare the total against their monthly income. This tool's entire point is a budget that genuinely zeroes out, and a single-shot mental sum over several line items is exactly the kind of arithmetic that's easy to get wrong without working it through step by step.",
      'columns/rows is the zero-based budget itself — organise it however fits (e.g. columns: Category, Type [Needs/Wants/Savings/Debt], Monthly Amount), one row per category, matching what workingOut actually summed to. The core rule of zero-based budgeting applies: every category should add up to their total income, with savings and debt repayment as their own explicit rows, never treated as an afterthought. If they\'ve told you where any leftover should go (e.g. "put the rest toward savings"), FOLD IT INTO that row\'s amount directly — never describe money as "going toward" a goal without actually adding it to that row\'s figure. Only use `note` to flag a gap when workingOut finds one AND it\'s genuinely unclear what it should be assigned to (e.g. "£45 of your £2,200 income isn\'t assigned to anything yet — what should it go toward?") — never as a substitute for finishing the assignment yourself when you already know where it should go.',
      'planKey is a short, stable, lowercase-hyphenated id for the CURRENT budget (e.g. "monthly-budget-aug", "house-deposit-budget") — reuse the exact same one on every reply that amends this same budget, only picking a new one if they want to start a genuinely different one. planTitle is always a short, human-readable name for it (e.g. "House Deposit Budget") — never leave it null when kind is "plan".',
      "Typical cost categories, their usual names, and the currency all vary by country (e.g. Council Tax in the UK vs. property tax and HOA fees in the US) — if the user's country is given below, use its currency and typical local category names rather than defaulting to assumptions from any one country.",
    ].join(' '),
    responseSchema: BUDGET_PLAN_SCHEMA,
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
