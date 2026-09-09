// Mirrors 101ai/web/src/tools/registry.ts (name + description only — the
// router needs enough to classify a message, not the full UI metadata).
// Keep these two lists in sync manually until a shared package exists.

export interface ToolCatalogEntry {
  slug: string;
  name: string;
  description: string;
}

export const TOOL_CATALOG: ToolCatalogEntry[] = [
  {
    slug: 'writer',
    name: 'Writer',
    description: 'Draft or improve a piece of writing.',
  },
  {
    slug: 'maths-solver',
    name: 'Maths Solver',
    description: 'Work through a maths problem step by step.',
  },
  {
    slug: 'word-helper',
    name: 'Word Helper',
    description: 'Find the right word or check its meaning.',
  },
  {
    slug: 'science-explainer',
    name: 'Science Explainer',
    description: 'Explain a science concept in plain language.',
  },
  {
    slug: 'history-helper',
    name: 'History Helper',
    description: 'Get context and explanations on historical events.',
  },
  {
    slug: 'film-recommendations',
    name: 'Film Recommendations',
    description: 'Get film picks based on your taste.',
  },
  {
    slug: 'book-recommendations',
    name: 'Book Recommendations',
    description: 'Get book picks based on your taste.',
  },
  {
    slug: 'music-recommendations',
    name: 'Music Recommendations',
    description: 'Get music picks based on your taste.',
  },
  {
    slug: 'story-explainer',
    name: 'Story Explainer',
    description: 'Understand the plot of a book, film, or show.',
  },
  {
    slug: 'quote-finder',
    name: 'Quote Finder',
    description: 'Find a quote from a book, film, or show.',
  },
  {
    slug: 'business-plan',
    name: 'Business Plan',
    description: 'Draft a simple business plan.',
  },
  {
    slug: 'business-research',
    name: 'Business Research',
    description: 'Research a market, competitor, or industry.',
  },
  {
    slug: 'ad-creator',
    name: 'Ad Creator',
    description: 'Write ad copy for a product or service.',
  },
  {
    slug: 'salary-calculator',
    name: 'Salary Calculator',
    description: 'Work out take-home pay from a salary.',
  },
  {
    slug: 'budget-planner',
    name: 'Budget Planner',
    description: 'Plan a monthly budget.',
  },
  {
    slug: 'career-planner',
    name: 'Career Planner',
    description: 'Map out next steps for your career.',
  },
  {
    slug: 'shopping',
    name: 'Shopping',
    description: 'Get help deciding what to buy.',
  },
  {
    slug: 'clothing',
    name: 'Clothing',
    description: 'Get outfit and clothing suggestions.',
  },
  {
    slug: 'insurance',
    name: 'Insurance',
    description: 'Compare insurance options and terms.',
  },
  {
    slug: 'general-health',
    name: 'General Health',
    description: 'Get general health guidance.',
  },
  {
    slug: 'diet',
    name: 'Diet Planner',
    description: 'Get diet and nutrition suggestions.',
  },
  {
    slug: 'self-care',
    name: 'Self Care',
    description: 'Get self-care ideas and routines.',
  },
  {
    slug: 'steps-planner',
    name: 'Steps Planner',
    description: 'Plan a walking or step goal.',
  },
  {
    slug: 'gym-planner',
    name: 'Gym Planner',
    description: 'Plan a gym or workout routine.',
  },
  {
    slug: 'cooking',
    name: 'Cooking Guide',
    description: 'Get food recipes, ideas and cooking instructions',
  },
  {
    slug: 'day-activity',
    name: 'Day Activity',
    description: 'Get ideas for things to do today.',
  },
  {
    slug: 'holiday-planning',
    name: 'Holiday Planning',
    description: 'Plan a trip from start to finish.',
  },
  {
    slug: 'politics',
    name: 'Politics',
    description: 'Understand a political topic or policy.',
  },
  { slug: 'news', name: 'News', description: 'Get a summary of a news topic.' },
  {
    slug: 'home',
    name: 'Home',
    description: 'Get help fixing something at home.',
  },
  { slug: 'car', name: 'Car', description: 'Get help with a car problem.' },
  { slug: 'diy', name: 'DIY', description: 'Get step-by-step DIY guidance.' },
  {
    slug: 'tech',
    name: 'Tech',
    description: 'Get help fixing a tech problem.',
  },
];

export function getToolCatalogEntry(
  slug: string,
): ToolCatalogEntry | undefined {
  return TOOL_CATALOG.find((tool) => tool.slug === slug);
}
