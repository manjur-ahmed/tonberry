export const categories = [
  'Education',
  'Health & Wellbeing',
  'Shopping',
  'How-to & Fixes',
  'Food & Cooking',
  'Entertainment & Media',
  'Politics & Current Affairs',
  'Travel & Leisure',
  'Personal Finance',
  'Business',
] as const

export type ToolCategory = (typeof categories)[number]

export interface Tool {
  slug: string
  name: string
  description: string
  icon: string
  category: ToolCategory
  // Liability/safety notice shown above the send button on ToolDashboard's
  // new-chat compose sheet (see ToolNotice) — e.g. "this isn't medical
  // advice" for a diet or cooking tool. Optional and tool-specific so any
  // future tool that needs one (legal, financial, safety...) can just set
  // this, without a bespoke mechanism per tool.
  warning?: string
  // Shows a "this works better with memory" nudge above Chat.tsx's reply
  // box while memory's off (see the memory promo notice there) — for the
  // handful of tools where an ongoing back-and-forth actually benefits from
  // it, rather than every tool.
  promoteMemory?: boolean
}

// Placeholder catalog — swap these for the real tools once decided.
// Each tool gets its own route (/tools/:slug) and, eventually, its own
// custom UI component rather than a generic chat box.
export const tools: Tool[] = [
  // Education
  {
    slug: 'writer',
    name: 'Writer',
    description: 'Draft or improve a piece of writing.',
    icon: '✍️',
    category: 'Education',
  },
  {
    slug: 'maths-solver',
    name: 'Maths Solver',
    description: 'Work through a maths problem step by step.',
    icon: '➗',
    category: 'Education',
  },
  {
    slug: 'word-helper',
    name: 'Word Helper',
    description: 'Find the right word or check its meaning.',
    icon: '🔤',
    category: 'Education',
  },
  {
    slug: 'science-explainer',
    name: 'Science Explainer',
    description: 'Explain a science concept in plain language.',
    icon: '🔬',
    category: 'Education',
  },
  {
    slug: 'history-helper',
    name: 'History Helper',
    description: 'Get context and explanations on historical events.',
    icon: '📜',
    category: 'Education',
  },

  // Entertainment & Media
  {
    slug: 'film-recommendations',
    name: 'Film Recommendations',
    description: 'Get film picks based on your taste.',
    icon: '🎬',
    category: 'Entertainment & Media',
  },
  {
    slug: 'book-recommendations',
    name: 'Book Recommendations',
    description: 'Get book picks based on your taste.',
    icon: '📚',
    category: 'Entertainment & Media',
  },
  {
    slug: 'music-recommendations',
    name: 'Music Recommendations',
    description: 'Get music picks based on your taste.',
    icon: '🎵',
    category: 'Entertainment & Media',
  },
  {
    slug: 'story-explainer',
    name: 'Story Explainer',
    description: 'Understand the plot of a book, film, or show.',
    icon: '📖',
    category: 'Entertainment & Media',
  },
  {
    slug: 'quote-finder',
    name: 'Quote Finder',
    description: 'Find a quote from a book, film, or show.',
    icon: '💬',
    category: 'Entertainment & Media',
  },

  // Business
  {
    slug: 'business-plan',
    name: 'Business Plan',
    description: 'Draft a simple business plan.',
    icon: '📈',
    category: 'Business',
  },
  {
    slug: 'business-research',
    name: 'Business Research',
    description: 'Research a market, competitor, or industry.',
    icon: '🔎',
    category: 'Business',
  },
  {
    slug: 'ad-creator',
    name: 'Ad Creator',
    description: 'Write ad copy for a product or service.',
    icon: '📣',
    category: 'Business',
  },

  // Personal Finance
  {
    slug: 'salary-calculator',
    name: 'Salary Calculator',
    description: 'Work out take-home pay from a salary.',
    icon: '💰',
    category: 'Personal Finance',
  },
  {
    slug: 'budget-planner',
    name: 'Budget Planner',
    description: 'Plan a monthly budget.',
    icon: '📊',
    category: 'Personal Finance',
  },
  {
    slug: 'career-planner',
    name: 'Career Planner',
    description: 'Map out next steps for your career.',
    icon: '🧭',
    category: 'Personal Finance',
  },

  // Shopping
  {
    slug: 'shopping',
    name: 'Shopping',
    description: 'Get help deciding what to buy.',
    icon: '🛒',
    category: 'Shopping',
  },
  {
    slug: 'clothing',
    name: 'Clothing',
    description: 'Get outfit and clothing suggestions.',
    icon: '👕',
    category: 'Shopping',
  },
  {
    slug: 'insurance',
    name: 'Insurance',
    description: 'Compare insurance options and terms.',
    icon: '🛡️',
    category: 'Shopping',
  },

  // Health & Wellbeing
  {
    slug: 'general-health',
    name: 'General Health',
    description: 'Get general health guidance.',
    icon: '🩺',
    category: 'Health & Wellbeing',
  },
  {
    slug: 'self-care',
    name: 'Self Care',
    description: 'Get self-care ideas and routines.',
    icon: '🧘',
    category: 'Health & Wellbeing',
  },
  {
    slug: 'steps-planner',
    name: 'Steps Planner',
    description: 'Plan a walking or step goal.',
    icon: '🚶',
    category: 'Health & Wellbeing',
  },
  {
    slug: 'gym-planner',
    name: 'Gym Planner',
    description: 'Plan a gym or workout routine.',
    icon: '🏋️',
    category: 'Health & Wellbeing',
  },

  // Food & Cooking
  {
    slug: 'diet',
    name: 'Diet Planner',
    description: 'Get diet and nutrition suggestions.',
    icon: '🥗',
    category: 'Food & Cooking',
    warning: "This isn't medical or dietetic advice — for medical conditions, allergies, or major diet changes, check with a doctor or registered dietitian first.",
    promoteMemory: true,
  },
  {
    slug: 'cooking',
    name: 'Cooking Guide',
    description: 'Get food recipes, ideas and cooking instructions',
    icon: '👨‍🍳',
    category: 'Food & Cooking',
    warning: 'Always check for allergens and follow safe food-handling and cooking temperatures — this tool can get things wrong.',
    promoteMemory: true,
  },

  // Travel & Leisure
  {
    slug: 'day-activity',
    name: 'Day Activity',
    description: 'Get ideas for things to do today.',
    icon: '🗺️',
    category: 'Travel & Leisure',
  },
  {
    slug: 'holiday-planning',
    name: 'Holiday Planning',
    description: 'Plan a trip from start to finish.',
    icon: '✈️',
    category: 'Travel & Leisure',
  },

  // Politics & Current Affairs
  {
    slug: 'politics',
    name: 'Politics',
    description: 'Understand a political topic or policy.',
    icon: '🏛️',
    category: 'Politics & Current Affairs',
  },
  {
    slug: 'news',
    name: 'News',
    description: 'Get a summary of a news topic.',
    icon: '📰',
    category: 'Politics & Current Affairs',
  },

  // How-to & Fixes
  {
    slug: 'home',
    name: 'Home',
    description: 'Get help fixing something at home.',
    icon: '🏠',
    category: 'How-to & Fixes',
  },
  {
    slug: 'car',
    name: 'Car',
    description: 'Get help with a car problem.',
    icon: '🚗',
    category: 'How-to & Fixes',
  },
  {
    slug: 'diy',
    name: 'DIY',
    description: 'Get step-by-step DIY guidance.',
    icon: '🔨',
    category: 'How-to & Fixes',
  },
  {
    slug: 'tech',
    name: 'Tech',
    description: 'Get help fixing a tech problem.',
    icon: '💻',
    category: 'How-to & Fixes',
  },
]

export function getTool(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug)
}
