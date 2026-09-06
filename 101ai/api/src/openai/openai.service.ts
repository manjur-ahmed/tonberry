import { Injectable } from '@nestjs/common';
import { getToolConfig } from '../tools/tool-config';

// Placeholder for the real OpenAI integration. Every tool currently
// returns a fixed canned reply regardless of what's asked — swap the body
// of generateReply for a real chat completion call (using getToolConfig's
// model/systemPrompt) once the UI + data shape are settled.
@Injectable()
export class OpenAiService {
  generateReply(toolSlug: string, _message: string): string {
    getToolConfig(toolSlug); // config is wired up, just unused until real calls happen

    if (toolSlug === 'word-helper') {
      // Structured, not prose — Word Helper's frontend ResponseView parses
      // this shape to render the definition card. Every message returns
      // the same "happy" payload for now, regardless of what's asked.
      return JSON.stringify({
        word: 'happy',
        phonetic: 'ˈhæp.i',
        shortDefinition: 'Feeling pleased, satisfied, or joyful.',
        meaning:
          'A positive emotional state characterized by joy, contentment, and satisfaction. It can also describe being pleased with a result or fortunate in a situation.',
        examples: ['She felt happy to see her friends again.', "I'm happy with the result."],
        synonyms: ['joyful', 'cheerful', 'delighted', 'content'],
        wordType: 'Adjective',
        related: ['happily', 'happiness'],
      });
    }
    return "This is a placeholder response — real AI replies aren't wired up yet.";
  }
}
