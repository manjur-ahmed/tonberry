import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { getToolConfig } from '../tools/tool-config';
import { UsageLogsService } from '../usage-logs/usage-logs.service';

// Default worst-case cost guard, used whenever a tool doesn't set its own
// maxCompletionTokens (see tool-config.ts) — comfortably covers the largest
// structured reply across tools today: film/book-recommendations
// enumerating a long real series in full (e.g. two dozen entries for a
// franchise like James Bond), each with a title/year/genre/summary/reason/
// rating. A plain taste-based request only produces 3 entries and uses a
// small fraction of this.
const MAX_COMPLETION_TOKENS = 2500;

// Bounds how much prior conversation gets sent on a long chat — a simple
// recency cutoff, not real pruning/summarization. Was 20 (10 exchanges) —
// too tight in practice: a recommendation tool (Film/Book/Music) that's
// told "never repeat something already recommended" can only honor that
// for whatever's still inside this window, and 20 was easy to blow through
// in an ordinary "give me more" back-and-forth, at which point the model
// genuinely can no longer see its own earlier replies (confirmed root
// cause of reported repeat-recommendation bug, 2026-09-16 — not a
// model-compliance issue). 60 gives real headroom (gpt-4o-mini's context
// window is nowhere close to being the actual constraint here) while still
// capping unboundedly long chats.
const MAX_HISTORY_MESSAGES = 60;

// Cheap, fast model for the small auxiliary calls below (route-intent
// extraction) — never needs the main chat model's capability, and running
// it there would just cost more for no benefit.
const AUX_MODEL = 'gpt-4o-mini';

const PLACEHOLDER_REPLY =
  "This is a placeholder response — real AI replies aren't wired up yet.";

const SHOPPING_INTENT_SYSTEM_PROMPT =
  'You help interpret a shopping request. You never invent a product, ' +
  "price, or seller yourself — that's found for real afterward by a " +
  'real shopping search, and that real search only ever runs once the ' +
  'user has actually confirmed what to look for — never on the first ' +
  'message naming a product. Decide "kind": (1) "chat" — greetings, ' +
  'small talk, or when it\'s genuinely too vague to know what they want ' +
  'yet (e.g. "I want to buy something") — write a short, warm reply ' +
  'asking what they\'re after, and leave "searchQuery" null. (2) ' +
  '"confirm" — the FIRST time enough is known to name a specific ' +
  'product (even a simple one like "a laptop" or "running shoes"), OR ' +
  'whenever they ask to change something about a product not yet ' +
  'confirmed/searched — restate concretely what you understood in ' +
  '"reply" and ask if they\'d like you to find some real options (e.g. ' +
  '"Got it — a red leather laptop bag. Want me to find some real ' +
  'options?"), and leave "searchQuery" null; do NOT search yet. (3) ' +
  '"shopping" — ONLY on a later message that clearly confirms/agrees to ' +
  'a product you already asked about in "confirm" (e.g. "yes", "go ' +
  'ahead", "please", "sounds good", "find it") — never on the same ' +
  'message that first names the product, even if it sounds complete or ' +
  'urgent; always confirm first. For "shopping", "searchQuery" is a ' +
  'short, complete, real-world product search phrase built from what ' +
  'you already confirmed (not from the bare "yes" itself), e.g. ' +
  '"wireless noise cancelling headphones", "red leather laptop bag", ' +
  'ready to run as-is; "reply" is null (the app builds the real reply ' +
  'from actual search results, never your own written text). ' +
  'REFINING AN ALREADY-FOUND PRODUCT: if the conversation history ' +
  'already shows a product this app found (its own reply describing a ' +
  'real item with a price — not just a "confirm" question), and this ' +
  'message asks for a CHANGE to that same thing (a different colour, ' +
  'size, brand, price range, or similar — e.g. "make it red", ' +
  '"something cheaper", "in a medium"), that change ALSO needs ' +
  'confirming first, same as a first-time request — use "confirm", ' +
  'restating the updated product (e.g. previous product "laptop bag", ' +
  'user says "make it red" → confirm "a red laptop bag"), then only ' +
  'move to "shopping" (with the full updated searchQuery, e.g. "red ' +
  'laptop bag") once THAT change is itself confirmed. Set ' +
  '"isRefinement" to true whenever the eventual "shopping" search is ' +
  'updating an already-found product rather than a brand new one; false ' +
  'otherwise. Respond with ONLY a JSON object: {"kind": ' +
  '"shopping"|"confirm"|"chat", "reply": string|null, "searchQuery": ' +
  'string|null, "isRefinement": boolean}.';

const ROUTE_INTENT_SYSTEM_PROMPT =
  'You help interpret a walking-route request. You never invent the route ' +
  "itself — that's computed for real afterward by a mapping service. " +
  'Decide: (1) "kind" — "route" if there\'s enough to act on: either a ' +
  'walking distance/step target for a loop, or a named destination for a ' +
  'point-to-point walk, AND one of: a named starting location, the app ' +
  "already knows the user's current location, OR they're asking which " +
  'stop/station to start from (see "startCategory" below — this counts ' +
  'as "route" too, even with no location named and no GPS, since the app ' +
  'itself finds the starting point in that case). "chat" otherwise — a ' +
  'greeting, small talk, or genuinely missing all three of those. For ' +
  '"chat", write a short, warm reply in "reply" (asking for a location/' +
  "distance if that's what's missing) and leave every other field null — " +
  'never write a "chat" reply that describes checking, finding, or ' +
  'looking something up: nothing runs unless "kind" is "route", so a ' +
  '"chat" reply must never claim to be about to do real work. (2) "mode" ' +
  '— "point_to_point" if a specific named ' +
  'destination is given (e.g. "walk to the train station"), else "loop" ' +
  '(return to the start, e.g. "walk 3000 steps around the block"). (3) ' +
  '"targetSteps" — a step count, used to size either a loop or how much ' +
  'to pad out a point-to-point walk. A bare number, with or without "k" ' +
  'or "steps" (e.g. "5k", "5k steps", "5000", "a 5k route") means STEPS, ' +
  'not kilometers — "5k" is exactly 5000 steps, never converted as a ' +
  'distance. Only convert to steps when a real distance unit is stated ' +
  '(e.g. "2km", "1.5 miles" — convert at ~1,300 steps/km). The number can ' +
  'appear anywhere in the sentence, not just at the start — e.g. "which ' +
  'stop should I use to get 2.5k steps in", "I need 2k steps to the tram ' +
  'stop" both mean targetSteps 2500/2000; always extract it whenever a ' +
  'step count or "Nk" appears, even mid-sentence or after other requests ' +
  'in the same message. (4) ' +
  '"startLocationName" — a named starting place ' +
  'if one is mentioned (e.g. "from Dudley town centre"), else null (means ' +
  'use their current location). (5) "destinationName" — the named ' +
  'destination for "point_to_point", else null. (6) "startCategory" — ' +
  'ONLY when the user is asking which transit stop/station to use as a ' +
  'starting point rather than naming one themselves (e.g. "which tram ' +
  'stop should I get off at to walk to work", "what bus stop should I ' +
  'start from"): a short category ("tram stop", "train station", "bus ' +
  'stop", "subway station"), and leave "startLocationName" null — never ' +
  'invent or guess a SPECIFIC real stop/station name yourself here (e.g. ' +
  'never answer with "startLocationName": "Lodge Road" for a question ' +
  'like this), since you have no way to know which real one is actually ' +
  'the right walking distance away; the app finds and checks real ' +
  'candidates for this instead. null when the user already named a ' +
  'specific start or is just using their current location. (7) ' +
  '"nearestOnly" — true when the user just wants the NEAREST/closest ' +
  'stop/station (with "startCategory" set) and to be told its real ' +
  'distance, WITHOUT giving a target distance of their own (e.g. "steps ' +
  'to the nearest tram stop", "how far is the closest bus stop", "find ' +
  'the nearest tram stop and how many steps it is") — in this case leave ' +
  '"targetSteps" null and do NOT ask them for a distance in "reply"; ' +
  'true here is itself enough to act on. false/omit whenever a distance ' +
  'is given or implied, or "startCategory" isn\'t set.\n\n' +
  'CONTINUING A PREVIOUS ROUTE: if the conversation history already has a ' +
  'route the app found (its reply says "Found a walking loop..." or ' +
  '"Route to ..."), treat a short follow-up that does NOT name a new ' +
  'place (e.g. "shorter", "make it longer", "5k instead", "try again", ' +
  '"less steps") as adjusting THAT SAME route, not starting an unrelated ' +
  'one — leave "destinationName"/"startLocationName" null so the app ' +
  'reuses the previous ones, and leave "mode" null too unless they ' +
  'explicitly ask to switch between a loop and a specific destination. ' +
  'For a comparative word like "shorter"/"less" or "longer"/"more" with ' +
  "no exact number, look at the previous reply's reported distance/steps " +
  'in the history and set "targetSteps" to a concretely smaller (roughly ' +
  '60% of it) or larger (roughly 160% of it) number — never leave it null ' +
  'when a comparative word like this is used. Only treat a follow-up as a ' +
  'genuinely new, unrelated route when it names a different place, a ' +
  'different starting point, or otherwise clearly abandons the previous ' +
  'one.\n\n' +
  'Respond with ONLY a JSON ' +
  'object: {"kind": "route"|"chat", "reply": string|null, "mode": ' +
  '"loop"|"point_to_point"|null, "targetSteps": number|null, ' +
  '"startLocationName": string|null, "destinationName": string|null, ' +
  '"startCategory": string|null, "nearestOnly": boolean}.';

// Used by needsMathsUpgrade (see ToolConfig.mathModelOverride) — a cheap
// pre-check so a tool like business-plan only pays for the stronger model
// on turns that actually need it, not every turn.
const MATHS_CHECK_SYSTEM_PROMPT =
  'Decide whether answering the LATEST message requires doing real ' +
  'numeric calculation where getting the arithmetic right actually ' +
  'matters — e.g. pricing, unit economics, a budget, startup costs, or ' +
  'any other figure that has to be computed correctly. General ideation, ' +
  'market/competitor discussion, or a plan section with no numbers to ' +
  'work out does NOT count, even if money or a word like "cost" or ' +
  '"price" comes up without an actual calculation to do. Respond with ' +
  'ONLY a JSON object: {"needsMaths": boolean}.';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateReplyParams {
  toolSlug: string;
  message: string;
  // Prior turns in this chat, oldest first, not including `message` itself
  // — without this every reply is stateless regardless of plan (see
  // chats.service.ts callers for where it comes from).
  history: HistoryMessage[];
  userId: string;
  chatId: string;
  messageId: string;
  // The user's own ISO 3166-1 alpha-2 country (User.country) — only
  // actually used by a tool that opts in via usesResidencyContext (see
  // tool-config.ts), e.g. Politics & Law needing to know which country's
  // law a jurisdiction-dependent question means. Null/undefined for a user
  // who hasn't set it yet; getToolConfig just omits the context in that case.
  userCountry?: string | null;
  // Image(s) on this specific turn — presigned, short-lived view URLs
  // already resolved from the stored S3 keys by the caller (see
  // ChatsService), never a raw key. Only ever set on the new user message,
  // not on `history` — a prior turn's own attachments aren't re-sent, same
  // as OpenAI's own multi-turn vision guidance (the model doesn't need to
  // re-see an image it already responded to once).
  attachments?: { url: string; contentType: string }[];
  // A saved item attached to this turn (see ChatsService.resolveAttachedItem),
  // already wrapped with its context preamble by the caller — folded into
  // the same user turn as `message`, not sent as separate history, so the
  // model reads it as "here's what this message is about" rather than a
  // detached prior exchange.
  itemContext?: string;
}

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI;

  constructor(
    config: ConfigService,
    private readonly usageLogs: UsageLogsService,
  ) {
    this.client = new OpenAI({ apiKey: config.get<string>('OPENAI_API_KEY') });
  }

  // Config-driven, not a per-tool branch — any slug with a TOOL_DEFINITIONS
  // entry (see tool-config.ts) gets a real call here, structured
  // (json_schema, strict) if it declares a responseSchema, plain text
  // otherwise. A slug with no entry gets the canned placeholder (and no
  // usage log — there's nothing to log).
  async generateReply(params: GenerateReplyParams): Promise<string> {
    const config = getToolConfig(params.toolSlug, params.userCountry);
    if (!config) return PLACEHOLDER_REPLY;

    try {
      // Plain string when there's nothing attached — only switches to the
      // multi-part content-array form (OpenAI's vision input shape) when
      // this specific turn actually has an image and/or an attached item,
      // so every existing text-only tool's request shape is completely
      // unchanged. itemContext (if any) comes first — it's the thing being
      // referenced, `message` is what the user actually wants done with it.
      const hasAttachments =
        Boolean(params.itemContext) ||
        (params.attachments && params.attachments.length > 0);
      const userContent = hasAttachments
        ? [
            ...(params.itemContext
              ? [{ type: 'text' as const, text: params.itemContext }]
              : []),
            { type: 'text' as const, text: params.message },
            ...(params.attachments ?? []).map((attachment) => ({
              type: 'image_url' as const,
              image_url: { url: attachment.url },
            })),
          ]
        : params.message;

      const model = config.mathModelOverride
        ? (await this.needsMathsUpgrade(params))
          ? config.mathModelOverride
          : config.model
        : config.model;

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...params.history.slice(-MAX_HISTORY_MESSAGES).map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          { role: 'user', content: userContent },
        ],
        max_completion_tokens:
          config.maxCompletionTokens ?? MAX_COMPLETION_TOKENS,
        response_format: config.responseSchema
          ? {
              type: 'json_schema',
              json_schema: {
                name: config.responseSchema.name,
                strict: true,
                schema: config.responseSchema.schema,
              },
            }
          : { type: 'text' },
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      const usage = response.usage;
      if (usage) {
        // model (what we actually requested — see the mathModelOverride
        // check above), not response.model (the specific dated snapshot
        // OpenAI actually served) — MODEL_PRICING is keyed by the
        // request-time name, so this is what actually resolves to a price.
        await this.usageLogs.record({
          userId: params.userId,
          chatId: params.chatId,
          messageId: params.messageId,
          toolSlug: params.toolSlug,
          model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
          prompt: params.message,
          response: content,
        });
      }

      return content;
    } catch {
      throw new InternalServerErrorException(
        'Could not generate a reply — try again.',
      );
    }
  }

  // Cheap pre-check backing ToolConfig.mathModelOverride — runs on AUX_MODEL,
  // same pattern as extractRouteIntent/the shopping-intent call below. Any
  // failure (bad JSON, API error) defaults to false rather than blocking the
  // real reply — worst case a maths-needing turn stays on the cheaper model
  // for once, which is far better than the real call failing outright.
  private async needsMathsUpgrade(
    params: GenerateReplyParams,
  ): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: AUX_MODEL,
        messages: [
          { role: 'system', content: MATHS_CHECK_SYSTEM_PROMPT },
          ...params.history.slice(-MAX_HISTORY_MESSAGES).map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          { role: 'user', content: params.message },
        ],
        max_completion_tokens: 20,
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0]?.message?.content;
      const usage = response.usage;
      if (usage) {
        await this.usageLogs.record({
          userId: params.userId,
          chatId: params.chatId,
          messageId: params.messageId,
          toolSlug: params.toolSlug,
          model: AUX_MODEL,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
          prompt: params.message,
          response: raw ?? undefined,
        });
      }
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { needsMaths?: boolean };
      return parsed.needsMaths === true;
    } catch {
      return false;
    }
  }

  // Deliberately separate from generateReply — no tool-config, no history,
  // no schema shared with any other tool. Used by StepsPlannerService to
  // interpret *intent* only (loop vs point-to-point, a step target, named
  // places) — the model never picks coordinates or describes a route it
  // hasn't seen computed; StepsPlannerService does the real geometry/Routes
  // API work afterward and builds the reply text itself from those real
  // numbers. Falls back to a "chat" reply asking the user to rephrase on
  // any failure, same defensive shape as extractSearchQuery.
  async extractRouteIntent(
    message: string,
    hasGpsLocation: boolean,
    userId: string,
    chatId: string,
    history: HistoryMessage[] = [],
  ): Promise<RouteIntent> {
    const fallback: RouteIntent = {
      kind: 'chat',
      reply:
        "Sorry, I didn't catch that — could you rephrase your walking request?",
      mode: null,
      targetSteps: null,
      startLocationName: null,
      destinationName: null,
      startCategory: null,
      nearestOnly: false,
    };
    try {
      const response = await this.client.chat.completions.create({
        model: AUX_MODEL,
        messages: [
          { role: 'system', content: ROUTE_INTENT_SYSTEM_PROMPT },
          ...history.map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          {
            role: 'user',
            content: `The app ${hasGpsLocation ? 'already knows' : 'does NOT know'} the user's current location.\n\nMessage: ${message}`,
          },
        ],
        max_completion_tokens: 150,
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0]?.message?.content;
      const usage = response.usage;
      if (usage) {
        await this.usageLogs.record({
          userId,
          chatId,
          messageId: null,
          toolSlug: 'steps-planner',
          model: AUX_MODEL,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
        });
      }
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const record =
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {};
      if (record.kind !== 'route' && record.kind !== 'chat') return fallback;
      return {
        kind: record.kind,
        reply: typeof record.reply === 'string' ? record.reply : fallback.reply,
        mode:
          record.mode === 'point_to_point'
            ? 'point_to_point'
            : record.mode === 'loop'
              ? 'loop'
              : null,
        targetSteps:
          typeof record.targetSteps === 'number' ? record.targetSteps : null,
        startLocationName:
          typeof record.startLocationName === 'string'
            ? record.startLocationName
            : null,
        destinationName:
          typeof record.destinationName === 'string'
            ? record.destinationName
            : null,
        startCategory:
          typeof record.startCategory === 'string'
            ? record.startCategory
            : null,
        nearestOnly: record.nearestOnly === true,
      };
    } catch {
      return fallback;
    }
  }

  // Deliberately separate from generateReply — same "AI extracts intent
  // only, real data produces the result" shape as extractRouteIntent.
  // ShoppingService does the real SerpApi search afterward and builds the
  // reply text itself from the real product found; the model never
  // invents a product, price, or seller. Falls back to a "chat" reply
  // asking the user to rephrase on any failure.
  async extractShoppingIntent(
    message: string,
    userId: string,
    chatId: string,
    history: HistoryMessage[] = [],
  ): Promise<ShoppingIntent> {
    const fallback: ShoppingIntent = {
      kind: 'chat',
      reply: "Sorry, I didn't catch that — what are you shopping for?",
      searchQuery: null,
      isRefinement: false,
    };
    try {
      const response = await this.client.chat.completions.create({
        model: AUX_MODEL,
        messages: [
          { role: 'system', content: SHOPPING_INTENT_SYSTEM_PROMPT },
          ...history.map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          { role: 'user', content: message },
        ],
        max_completion_tokens: 150,
        response_format: { type: 'json_object' },
      });
      const raw = response.choices[0]?.message?.content;
      const usage = response.usage;
      if (usage) {
        await this.usageLogs.record({
          userId,
          chatId,
          messageId: null,
          toolSlug: 'shopping',
          model: AUX_MODEL,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
        });
      }
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const record =
        parsed && typeof parsed === 'object'
          ? (parsed as Record<string, unknown>)
          : {};
      if (
        record.kind !== 'shopping' &&
        record.kind !== 'confirm' &&
        record.kind !== 'chat'
      ) {
        return fallback;
      }
      return {
        kind: record.kind,
        reply: typeof record.reply === 'string' ? record.reply : fallback.reply,
        searchQuery:
          typeof record.searchQuery === 'string' ? record.searchQuery : null,
        isRefinement: record.isRefinement === true,
      };
    } catch {
      return fallback;
    }
  }
}

export interface ShoppingIntent {
  // 'confirm' — enough is known to name a product, but the user hasn't
  // yet agreed to a real search; 'shopping' — they just confirmed, run
  // the real search. See SHOPPING_INTENT_SYSTEM_PROMPT for the full
  // confirm-then-search flow.
  kind: 'shopping' | 'confirm' | 'chat';
  reply: string;
  searchQuery: string | null;
  // True when this message is refining the SAME product already found in
  // this chat (see ShoppingService's continuation handling) — false for a
  // genuinely new, unrelated search.
  isRefinement: boolean;
}

export interface RouteIntent {
  kind: 'route' | 'chat';
  reply: string;
  mode: 'loop' | 'point_to_point' | null;
  targetSteps: number | null;
  // Set instead of startLocationName when the user wants the app to
  // recommend a real stop/station of this category near the destination
  // (see StepsPlannerService's stop-finding flow) — never a specific
  // place name the model guessed itself.
  startCategory: string | null;
  // Only meaningful alongside startCategory — the user wants the NEAREST
  // one and its real distance, with no target distance of their own (see
  // StepsPlannerService's nearest-stop handling).
  nearestOnly: boolean;
  startLocationName: string | null;
  destinationName: string | null;
}
