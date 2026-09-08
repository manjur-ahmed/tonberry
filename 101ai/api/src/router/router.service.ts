import { Injectable } from '@nestjs/common';

export interface RouterResult {
  redirect: boolean;
  toolSlug?: string;
}

@Injectable()
export class RouterService {
  // Disabled for now — this was a single hardcoded keyword rule (any
  // message containing "blog" outside the writer tool) standing in for a
  // real classifier, and it's wrong in both directions: it missed genuine
  // cross-tool requests that didn't happen to say "blog" (e.g. "help me
  // with a business plan" from within word-helper), and it wrongly fired
  // on legitimate in-tool requests that just happened to mention the word
  // (e.g. "define blog" in word-helper). Each tool's system prompt now
  // carries its own scope guard as a fallback (see buildScopeGuard in
  // tool-config.ts), which declines and suggests switching tools without
  // needing this separate check to fire correctly.
  //
  // The real fix is an OpenAI function-calling call fed TOOL_CATALOG plus
  // the message, returning a tool slug to redirect to (or none) — that's
  // a deliberate follow-up, not done here, since it adds real latency and
  // per-message cost that deserves its own decision rather than being
  // folded into this change.
  check(_message: string, _currentToolSlug: string): RouterResult {
    return { redirect: false };
  }
}
