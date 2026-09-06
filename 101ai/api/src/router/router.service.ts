import { Injectable } from '@nestjs/common';
import { TOOL_CATALOG } from '../tools/tool-catalog';

export interface RouterResult {
  redirect: boolean;
  toolSlug?: string;
}

@Injectable()
export class RouterService {
  // Placeholder for the real classifier — this is meant to become an
  // OpenAI function-calling call fed TOOL_CATALOG plus the message, which
  // returns a tool slug to redirect to (or none). For now it's a single
  // hardcoded rule so the redirect flow can be exercised end to end
  // without an API call.
  check(message: string, currentToolSlug: string): RouterResult {
    const looksLikeBlogRequest = /\bblog\b/i.test(message);
    if (looksLikeBlogRequest && currentToolSlug !== 'writer') {
      const target = TOOL_CATALOG.find((tool) => tool.slug === 'writer');
      if (target) return { redirect: true, toolSlug: target.slug };
    }
    return { redirect: false };
  }
}
