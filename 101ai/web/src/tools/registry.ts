export interface Tool {
  slug: string
  name: string
  description: string
  icon: string
}

// Placeholder catalog — swap these for the real tools once decided.
// Each tool gets its own route (/tools/:slug) and, eventually, its own
// custom UI component rather than a generic chat box.
export const tools: Tool[] = [
  {
    slug: 'text-summarizer',
    name: 'Text Summarizer',
    description: 'Paste in long text, get a concise summary back.',
    icon: '📝',
  },
  {
    slug: 'resume-rewriter',
    name: 'Resume Bullet Rewriter',
    description: 'Turn a rough bullet point into a polished one.',
    icon: '📄',
  },
  {
    slug: 'currency-converter',
    name: 'Currency Converter',
    description: 'Convert between currencies using live exchange rates.',
    icon: '💱',
  },
]

export function getTool(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug)
}
