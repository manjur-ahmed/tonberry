export const categories = [
  'Learning',
  'Health & Wellbeing',
  'Shopping',
  'How-to & Fixes',
  'Food & Cooking',
  'Entertainment & Media',
  'Politics & Current Affairs',
  'Leisure & Events',
  'Personal Finance',
  'Business',
] as const

export type ToolCategory = (typeof categories)[number]

// Per-category color pair — `icon` for a tool/item's icon badge background,
// `shadow` for ToolCard's offset drop-shadow block behind it. Lives here
// (not in a component file) so it's just a plain data import for anything
// that needs a tool's category color, without dragging react-refresh's
// only-export-components rule into it.
export const categoryStyles: Record<ToolCategory, { icon: string; shadow: string }> = {
  Learning: { icon: 'bg-sky-100', shadow: 'bg-sky-200' },
  'Entertainment & Media': { icon: 'bg-fuchsia-100', shadow: 'bg-fuchsia-200' },
  Business: { icon: 'bg-indigo-100', shadow: 'bg-indigo-200' },
  'Personal Finance': { icon: 'bg-rose-100', shadow: 'bg-rose-200' },
  Shopping: { icon: 'bg-amber-100', shadow: 'bg-amber-200' },
  'Health & Wellbeing': { icon: 'bg-emerald-100', shadow: 'bg-emerald-200' },
  'Food & Cooking': { icon: 'bg-orange-100', shadow: 'bg-orange-200' },
  'Leisure & Events': { icon: 'bg-cyan-100', shadow: 'bg-cyan-200' },
  'Politics & Current Affairs': { icon: 'bg-violet-100', shadow: 'bg-violet-200' },
  'How-to & Fixes': { icon: 'bg-red-100', shadow: 'bg-red-200' },
}

// One entry in the compose FAB's menu when a tool opts into
// multiActionCompose (see Tool below) — 'note' sends the user straight into
// NoteEditor to start writing; 'chat' opens the existing chat composer
// sheet, same as the plain single-action FAB does today.
export interface ComposeOption {
  label: string
  action: 'note' | 'chat'
}

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
  // Hides ToolDashboard's "Chats" tab for a tool that isn't chat-based —
  // currently just Writer, which works off standalone notes (still saved
  // as Items) instead of a message thread. Items/Examples are unaffected.
  hideChatsTab?: boolean
  // Label on ToolDashboard's compose FAB. Defaults to 'New Chat' when unset.
  composeLabel?: string
  // When true, the FAB grows an up-chevron and tapping it opens a stack of
  // composeOptions pills instead of going straight to the chat composer —
  // for a tool where "start something new" isn't a single obvious action.
  multiActionCompose?: boolean
  // The FAB's menu items when multiActionCompose is true. Ignored otherwise.
  composeOptions?: ComposeOption[]
  // Shows Chat.tsx/ToolDashboard.tsx's "Allow location" banner and enables
  // the cached-GPS flow (see lib/gpsLocation.ts) — for a tool whose real
  // answer depends on where the user actually is (Steps Planner's routes,
  // Activity Planner's nearby venues), not just their country.
  needsLocation?: boolean
  // Hides the tool from Home's browse grid/search and the "send to another
  // tool" picker (see visibleTools below) — for a tool taken out of
  // circulation without breaking existing chats/items that still reference
  // its slug (getTool still resolves it normally, so old News chats/items
  // keep rendering fine; it just can't be started fresh).
  hidden?: boolean
}

// Placeholder catalog — swap these for the real tools once decided.
// Each tool gets its own route (/tools/:slug) and, eventually, its own
// custom UI component rather than a generic chat box.
export const tools: Tool[] = [
  // Learning
  {
    slug: 'writer',
    name: 'Notes',
    description: 'Note taking or draft a piece of writing.',
    icon: '✍️',
    category: 'Learning',
    hideChatsTab: true,
    composeLabel: 'New Note',
    multiActionCompose: true,
    composeOptions: [
      { label: 'New Note', action: 'note' },
      { label: 'Generate with AI', action: 'chat' },
    ],
  },
  {
    slug: 'maths-solver',
    name: 'Maths Solver',
    description: 'Work through a maths problem step by step.',
    icon: '➗',
    category: 'Learning',
  },
  {
    slug: 'word-helper',
    name: 'Word Helper',
    description: 'Find the right word or check its meaning.',
    icon: '🔤',
    category: 'Learning',
  },
  {
    slug: 'science-explainer',
    name: 'Science Explainer',
    description: 'Explain a science concept in plain language.',
    icon: '🔬',
    category: 'Learning',
  },
  {
    slug: 'history-helper',
    name: 'History Helper',
    description: 'Get context and explanations on historical events.',
    icon: '📜',
    category: 'Learning',
  },
  {
    slug: 'politics',
    name: 'Politics & Law',
    description: 'Understand a political topic or policy.',
    icon: '🏛️',
    category: 'Learning',
    warning:
      "For a specific legal situation, speak to a qualified lawyer. Any views expressed here are the AI's own and don't represent the company.",
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
    slug: 'show-recommendations',
    name: 'Show Recommendations',
    description: 'Get TV show picks based on your taste.',
    icon: '📺',
    category: 'Entertainment & Media',
  },
  {
    slug: 'book-recommendations',
    name: 'Read Recommendations',
    description: 'Get book, manga, and comic picks based on your taste.',
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
    description: 'Write a ready-to-post listing for something you’re selling.',
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
    warning: "This isn't financial advice, for debt, tax, or investment decisions, speak to a qualified financial adviser.",
    promoteMemory: true,
  },
  {
    slug: 'career-planner',
    name: 'Career Planner',
    description: 'Map out next steps for your career.',
    icon: '🧭',
    category: 'Personal Finance',
  },
  {
    slug: 'bills-utilities',
    name: 'Bills & Utilities',
    description: 'Get help with insurance, energy, phone, and other household bills.',
    icon: '🧾',
    category: 'Personal Finance',
    warning:
      "This isn't a live quote or confirmed pricing — always compare real current deals yourself (e.g. via a comparison site) before switching or buying.",
  },

  // Shopping
  {
    slug: 'shopping',
    name: 'Shopping',
    description: 'Get help deciding what to buy.',
    icon: '🛒',
    category: 'Shopping',
    warning:
      'Prices, stock, and offers change constantly and may not be current — always check the real price and availability on the seller\'s own site before buying.',
  },
  {
    slug: 'clothing',
    name: 'Clothes',
    description: 'Get outfit and clothing suggestions.',
    icon: '👕',
    category: 'Shopping',
    warning:
      'Prices, stock, and offers change constantly and may not be current — always check the real price, size, and availability on the seller\'s own site before buying.',
    promoteMemory: true,
  },

  // Health & Wellbeing
  {
    slug: 'general-health',
    name: 'General Health',
    description: 'Get general health guidance.',
    icon: '🩺',
    category: 'Health & Wellbeing',
    warning: "This isn't a diagnosis or medical advice — for symptoms or anything health-related, always check with a doctor or other qualified healthcare professional.",
  },
  {
    slug: 'self-care',
    name: 'Self Care',
    description: 'Get self-care ideas and routines.',
    icon: '🧘',
    category: 'Health & Wellbeing',
    warning: "This is general advice, it is recommended to see a pharmacist or beautician to have a closer look at you.",
    promoteMemory: true,
  },
  {
    slug: 'steps-planner',
    name: 'Steps Planner',
    description: 'Plan a walking or step goal.',
    icon: '🚶',
    category: 'Health & Wellbeing',
    warning:
      'Routes are generated automatically — always use your own judgement about whether a suggested route is safe for you, especially at night or walking alone.',
    needsLocation: true,
  },
  {
    slug: 'gym-planner',
    name: 'Gym Planner',
    description: 'Plan a gym or workout routine.',
    icon: '🏋️',
    category: 'Health & Wellbeing',
    promoteMemory: true,
  },

  // Food & Cooking
  {
    slug: 'diet',
    name: 'Diet Planner',
    description: 'Get diet and nutrition suggestions.',
    icon: '🥗',
    category: 'Food & Cooking',
    warning: "This isn't medical advice — for conditions, allergies, or major diet changes, check with a doctor or registered dietitian first.",
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

  // Leisure & Events
  {
    slug: 'day-activity',
    name: 'Activity Finder',
    description: 'Find ideas for things to do today.',
    icon: '🗺️',
    category: 'Leisure & Events',
    needsLocation: true,
  },
  {
    slug: 'holiday-planning',
    name: 'Holiday Planning',
    description: 'Plan a trip from start to finish.',
    icon: '✈️',
    category: 'Leisure & Events',
  },
  {
    slug: 'event-planner',
    name: 'Event Planner',
    description: 'Plan an event, party, or gathering.',
    icon: '🎉',
    category: 'Leisure & Events',
  },

  // Politics & Current Affairs
  {
    slug: 'news',
    name: 'News',
    description: 'Get a summary of a news topic.',
    icon: '📰',
    category: 'Politics & Current Affairs',
    warning:
      "This isn't a live news feed — answers come from the AI's own knowledge, which has a training cutoff and can be wrong or out of date. Always check a real news source for anything current or important.",
    // Taken out of circulation for now — kept in the registry (rather than
    // deleted outright) so existing News chats/items still resolve via
    // getTool and keep rendering normally; see the `hidden` field's comment.
    hidden: true,
  },

  // How-to & Fixes
  {
    slug: 'home',
    name: 'Home',
    description: 'Get help fixing something at home.',
    icon: '🏠',
    category: 'How-to & Fixes',
    warning:
      "This isn't professional advice, for electrics, gas, or structural work, use a qualified tradesperson.",
  },
  {
    slug: 'car',
    name: 'Car',
    description: 'Get help with a car problem.',
    icon: '🚗',
    category: 'How-to & Fixes',
    warning:
      "This isn't professional advice, for brakes, steering, or other safety-critical parts, visit your local garage.",
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

// Everywhere a tool is listed for browsing/picking (Home's grid/search,
// ItemDetailModal's "send to another tool" picker) should use this instead
// of the raw `tools` array, so a `hidden` tool (see the Tool interface)
// drops out of discovery while still resolving normally via getTool for
// anything that already references its slug (an existing chat/item).
export const visibleTools = tools.filter((tool) => !tool.hidden)
