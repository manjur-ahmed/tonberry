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
  // Extra terms Home's search matches against alongside name/description —
  // things a user might actually type that never appear in either (e.g.
  // "netflix" or "cinema" for Film Recommendations). See searchTools below.
  keywords?: string[]
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
    keywords: [
      'notebook', 'journal', 'journaling', 'diary', 'draft', 'drafting', 'memo', 'jot',
      'jotting', 'essay', 'blog post', 'blogging', 'article', 'letter', 'list', 'checklist',
      'to-do list', 'ideas', 'brainstorm', 'brainstorming', 'outline', 'write', 'writing', 'copy',
    ],
  },
  {
    slug: 'maths-solver',
    name: 'Maths Solver',
    description: 'Work through a maths problem step by step.',
    icon: '➗',
    category: 'Learning',
    keywords: [
      'math', 'mathematics', 'calculator', 'equation', 'equations', 'algebra', 'arithmetic',
      'homework', 'calculation', 'calculate', 'geometry', 'trigonometry', 'calculus', 'fractions',
      'percentages', 'word problem', 'formula', 'solve', 'solving', 'numbers', 'sums', 'division',
      'multiplication', 'statistics',
    ],
  },
  {
    slug: 'word-helper',
    name: 'Word Helper',
    description: 'Find the right word or check its meaning.',
    icon: '🔤',
    category: 'Learning',
    keywords: [
      'dictionary', 'definition', 'definitions', 'meaning', 'synonym', 'synonyms', 'antonym',
      'thesaurus', 'spelling', 'spell check', 'vocabulary', 'word meaning', 'crossword', 'scrabble',
      'grammar', 'translate', 'translation', 'pronunciation', 'etymology', 'wordle', 'phrase',
      'terminology', 'word game',
    ],
  },
  {
    slug: 'document-explainer',
    name: 'Document Explainer',
    description: 'Understand a document — attach one and ask about it.',
    icon: '📄',
    category: 'Learning',
    keywords: [
      'pdf', 'docx', 'doc', 'file', 'upload', 'summarize', 'summary', 'summarise', 'contract',
      'paperwork', 'report', 'letter', 'agreement', 'terms and conditions', 'small print',
      'legal document', 'form', 'statement', 'invoice', 'explain document', 'read for me',
      'attachment', 'scan document',
    ],
  },
  {
    slug: 'science-explainer',
    name: 'Science Explainer',
    description: 'Explain a science concept in plain language.',
    icon: '🔬',
    category: 'Learning',
    keywords: [
      'physics', 'chemistry', 'biology', 'concept', 'homework', 'explain', 'science fair',
      'experiment', 'theory', 'astronomy', 'space', 'atoms', 'molecules', 'evolution', 'genetics',
      'energy', 'force', 'gravity', 'science question', 'how does it work', 'science project',
      'science homework',
    ],
  },
  {
    slug: 'history-helper',
    name: 'History Helper',
    description: 'Get context and explanations on historical events.',
    icon: '📜',
    category: 'Learning',
    keywords: [
      'historical', 'past', 'timeline', 'events', 'era', 'war', 'context', 'ancient history',
      'world war', 'empire', 'revolution', 'historical figure', 'date', 'century', 'dynasty',
      'civilization', 'monarch', 'king', 'queen', 'battle', 'historical event', 'history homework',
    ],
  },
  {
    slug: 'politics',
    name: 'Politics & Law',
    description: 'Understand a political topic or policy.',
    icon: '🏛️',
    category: 'Learning',
    warning:
      "For a specific legal situation, speak to a qualified lawyer. Any views expressed here are the AI's own and don't represent the company.",
    keywords: [
      'legal', 'government', 'policy', 'election', 'rights', 'law', 'politician', 'parliament',
      'congress', 'voting', 'vote', 'democracy', 'law explained', 'court', 'legislation', 'bill',
      'referendum', 'party politics', 'prime minister', 'president', 'human rights',
      'current government',
    ],
  },

  // Entertainment & Media
  {
    slug: 'film-recommendations',
    name: 'Film Recommendations',
    description: 'Get film picks based on your taste.',
    icon: '🎬',
    category: 'Entertainment & Media',
    keywords: [
      'movie', 'movies', 'suggestions', 'cinema', 'netflix', 'watch', 'film', 'films',
      'what to watch', 'watchlist', 'movie night', 'blockbuster', 'streaming', 'recommend a movie',
      'good movie', 'best movies', 'movie ideas', 'imdb', 'hollywood', 'action movie',
      'comedy movie', 'romance movie', 'horror movie',
    ],
  },
  {
    slug: 'show-recommendations',
    name: 'Show Recommendations',
    description: 'Get TV show picks based on your taste.',
    icon: '📺',
    category: 'Entertainment & Media',
    keywords: [
      'tv', 'television', 'series', 'netflix', 'binge', 'streaming', 'suggestions', 'tv show',
      'show', 'what to watch', 'watchlist', 'disney plus', 'amazon prime', 'hbo', 'drama series',
      'sitcom', 'binge watch', 'new series', 'tv series', 'next show', 'best shows',
      'tv recommendation',
    ],
  },
  {
    slug: 'book-recommendations',
    name: 'Read Recommendations',
    description: 'Get book, manga, and comic picks based on your taste.',
    icon: '📚',
    category: 'Entertainment & Media',
    keywords: [
      'book', 'books', 'manga', 'comic', 'reading', 'novel', 'kindle', 'suggestions',
      'what to read', 'book recommendation', 'audiobook', 'fiction', 'non-fiction', 'bestseller',
      'author', 'book club', 'reading list', 'goodreads', 'graphic novel', 'next book',
      'good book', 'comic book',
    ],
  },
  {
    slug: 'music-recommendations',
    name: 'Music Recommendations',
    description: 'Get music picks based on your taste.',
    icon: '🎵',
    category: 'Entertainment & Media',
    keywords: [
      'songs', 'playlist', 'artist', 'spotify', 'album', 'tracks', 'suggestions', 'music',
      'what to listen to', 'new music', 'band', 'genre', 'apple music', 'song recommendation',
      'playlist ideas', 'listening', 'mood music', 'song suggestion', 'artist recommendation',
      'music discovery', 'song ideas',
    ],
  },
  {
    slug: 'story-explainer',
    name: 'Story Explainer',
    description: 'Understand the plot of a book, film, or show.',
    icon: '📖',
    category: 'Entertainment & Media',
    keywords: [
      'plot', 'summary', 'spoiler', 'ending', 'storyline', 'recap', 'explain', 'what happened',
      'plot explained', 'ending explained', 'book plot', 'movie plot', 'tv plot',
      'confusing ending', 'plot summary', 'character', 'twist', 'meaning of ending',
      'story breakdown', 'explain the ending',
    ],
  },
  {
    slug: 'quote-finder',
    name: 'Quote Finder',
    description: 'Find a quote from a book, film, or show.',
    icon: '💬',
    category: 'Entertainment & Media',
    keywords: [
      'quote', 'quotes', 'line', 'saying', 'script', 'dialogue', 'famous quote', 'movie quote',
      'book quote', 'who said', 'find a quote', 'memorable line', 'catchphrase', 'famous line',
      'quotation', 'source of quote', 'exact quote', 'tv quote', 'show quote', 'character quote',
      'speech',
    ],
  },

  // Business
  {
    slug: 'business-plan',
    name: 'Business Plan',
    description: 'Draft a simple business plan.',
    icon: '📈',
    category: 'Business',
    keywords: [
      'startup', 'company', 'pitch', 'entrepreneur', 'idea', 'business idea', 'pitch deck',
      'business model', 'launch a business', 'new business', 'small business', 'business proposal',
      'executive summary', 'swot analysis', 'mission statement', 'funding', 'investors',
      'startup idea', 'side hustle', 'venture', 'company plan',
    ],
  },
  {
    slug: 'business-research',
    name: 'Business Research',
    description: 'Research a market, competitor, or industry.',
    icon: '🔎',
    category: 'Business',
    keywords: [
      'market research', 'competitor', 'industry', 'analysis', 'company', 'competitor analysis',
      'market analysis', 'industry trends', 'swot', 'target market', 'market size',
      'due diligence', 'company research', 'industry report', 'competitive landscape',
      'business intelligence', 'market study', 'research a company', 'research a market',
      'sector analysis', 'trends',
    ],
  },
  {
    slug: 'ad-creator',
    name: 'Ad Creator',
    description: 'Write a ready-to-post listing for something you’re selling.',
    icon: '📣',
    category: 'Business',
    keywords: [
      'advert', 'advertisement', 'listing', 'ebay', 'marketplace', 'sell', 'selling', 'gumtree',
      'facebook marketplace', 'classified ad', 'product listing', 'sales copy', 'ad copy',
      'promote', 'promotion', 'listing description', 'sell online', 'craigslist', 'vinted',
      'depop', 'for sale',
    ],
  },

  // Personal Finance
  {
    slug: 'salary-calculator',
    name: 'Salary Calculator',
    description: 'Work out take-home pay from a salary.',
    icon: '💰',
    category: 'Personal Finance',
    keywords: [
      'wage', 'pay', 'income', 'take-home', 'paycheck', 'tax', 'gross pay', 'net pay',
      'hourly rate', 'annual salary', 'payslip', 'income tax', 'national insurance', 'pension',
      'deductions', 'salary breakdown', 'how much will i earn', 'pay calculator',
      'wage calculator', 'salary after tax',
    ],
  },
  {
    slug: 'budget-planner',
    name: 'Budget Planner',
    description: 'Plan a monthly budget.',
    icon: '📊',
    category: 'Personal Finance',
    warning: "This isn't financial advice, for debt, tax, or investment decisions, speak to a qualified financial adviser.",
    promoteMemory: true,
    keywords: [
      'money', 'spending', 'savings', 'finances', 'expenses', 'monthly budget', 'save money',
      'budgeting', 'financial plan', 'money management', 'track spending',
      'income and expenses', 'spreadsheet', 'save for', 'financial goals', 'cut costs',
      'money saving', 'personal finance', 'cash flow', 'outgoings',
    ],
  },
  {
    slug: 'career-planner',
    name: 'Career Planner',
    description: 'Map out next steps for your career.',
    icon: '🧭',
    category: 'Personal Finance',
    keywords: [
      'job', 'promotion', 'cv', 'resume', 'work', 'career change', 'job search', 'interview',
      'career path', 'career advice', 'job application', 'linkedin', 'cover letter', 'upskilling',
      'career goals', 'professional development', 'job interview', 'new career', 'career move',
      'next job',
    ],
  },
  {
    slug: 'bills-utilities',
    name: 'Bills & Utilities',
    description: 'Get help with insurance, energy, phone, and other household bills.',
    icon: '🧾',
    category: 'Personal Finance',
    warning:
      "This isn't a live quote or confirmed pricing — always compare real current deals yourself (e.g. via a comparison site) before switching or buying.",
    keywords: [
      'bills', 'energy', 'insurance', 'phone', 'broadband', 'household', 'gas', 'electricity',
      'water bill', 'utility bill', 'council tax', 'mobile bill', 'switch provider',
      'energy supplier', 'home insurance', 'car insurance', 'compare bills', 'reduce bills',
      'household expenses', 'monthly bills',
    ],
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
    keywords: [
      'buy', 'purchase', 'shop', 'product', 'deal', 'price', 'what to buy', 'best deal',
      'online shopping', 'compare prices', 'gift idea', 'present idea', 'product recommendation',
      'bargain', 'discount', 'sale', 'shopping list', 'find a product', 'best price',
      'where to buy',
    ],
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
    keywords: [
      'outfit', 'fashion', 'wardrobe', 'style', 'wear', 'what to wear', 'outfit ideas',
      'clothing suggestion', 'dress code', 'fashion advice', 'capsule wardrobe', 'trend',
      'trends', 'styling', 'look', 'fit', 'size guide', 'shopping for clothes',
      'wardrobe update', 'clothes shopping',
    ],
  },

  // Health & Wellbeing
  {
    slug: 'general-health',
    name: 'General Health',
    description: 'Get general health guidance.',
    icon: '🩺',
    category: 'Health & Wellbeing',
    warning: "This isn't a diagnosis or medical advice — for symptoms or anything health-related, always check with a doctor or other qualified healthcare professional.",
    keywords: [
      'symptoms', 'illness', 'wellbeing', 'medical', 'sick', 'health advice', 'feeling unwell',
      'health question', 'condition', 'pain', 'cold', 'flu', 'fever', 'health tips',
      'general wellbeing', 'health concern', 'am i ok', 'health guidance', 'wellness',
      'not feeling well',
    ],
  },
  {
    slug: 'self-care',
    name: 'Self Care',
    description: 'Get self-care ideas and routines.',
    icon: '🧘',
    category: 'Health & Wellbeing',
    warning: "This is general advice, it is recommended to see a pharmacist or beautician to have a closer look at you.",
    promoteMemory: true,
    keywords: [
      'relax', 'wellness', 'skincare', 'beauty', 'mental health', 'self care routine',
      'relaxation', 'stress relief', 'me time', 'mindfulness', 'pamper', 'spa day',
      'beauty routine', 'skin routine', 'unwind', 'destress', 'calm', 'wellbeing routine',
      'self love', 'recharge',
    ],
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
    keywords: [
      'walk', 'walking', 'route', 'exercise', 'steps', 'step count', 'walking route',
      'daily steps', 'walk planner', 'pedometer', '10000 steps', 'walking goal', 'stroll',
      'walking distance', 'fitness walk', 'walk to work', 'walking app', 'step goal',
      'step challenge', 'walking plan',
    ],
  },
  {
    slug: 'gym-planner',
    name: 'Gym Planner',
    description: 'Plan a gym or workout routine.',
    icon: '🏋️',
    category: 'Health & Wellbeing',
    promoteMemory: true,
    keywords: [
      'workout', 'exercise', 'fitness', 'training', 'reps', 'weights', 'gym routine',
      'workout plan', 'exercise plan', 'strength training', 'cardio', 'gym schedule', 'lifting',
      'muscle building', 'fitness goal', 'training program', 'gym session', 'exercise routine',
      'workout routine', 'gym plan',
    ],
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
    keywords: [
      'nutrition', 'food plan', 'calories', 'meal plan', 'weight loss', 'diet plan',
      'eating plan', 'healthy eating', 'macros', 'calorie counting', 'weight management',
      'nutrition advice', 'meal prep', 'diet advice', 'healthy diet', 'food tracker',
      'eating healthy', 'weight gain', 'clean eating', 'diet tips',
    ],
  },
  {
    slug: 'cooking',
    name: 'Cooking Guide',
    description: 'Get food recipes, ideas and cooking instructions',
    icon: '👨‍🍳',
    category: 'Food & Cooking',
    warning: 'Always check for allergens and follow safe food-handling and cooking temperatures — this tool can get things wrong.',
    promoteMemory: true,
    keywords: [
      'recipe', 'recipes', 'cook', 'meal', 'dinner', 'ingredients', 'what to cook',
      'dinner ideas', 'recipe ideas', 'cooking instructions', 'meal idea', 'food idea',
      'lunch idea', 'breakfast idea', 'cooking tips', 'kitchen', 'chef', 'cuisine', 'dish',
      'cooking guide', 'cookbook',
    ],
  },

  // Leisure & Events
  {
    slug: 'day-activity',
    name: 'Activity Finder',
    description: 'Find ideas for things to do today.',
    icon: '🗺️',
    category: 'Leisure & Events',
    needsLocation: true,
    keywords: [
      'things to do', 'activities', 'day out', 'nearby', 'ideas', 'what to do today', 'day trip',
      'local activities', 'things to do near me', 'entertainment ideas', 'fun things to do',
      'weekend ideas', 'family activities', 'date ideas', 'free things to do', 'activity ideas',
      'days out', "what's on", 'kids activities', 'outing',
    ],
  },
  {
    slug: 'holiday-planning',
    name: 'Holiday Planning',
    description: 'Plan a trip from start to finish.',
    icon: '✈️',
    category: 'Leisure & Events',
    keywords: [
      'holiday', 'vacation', 'trip', 'travel', 'itinerary', 'trip planner', 'travel plan',
      'travel itinerary', 'holiday ideas', 'city break', 'travel guide', 'destination',
      'flights', 'hotel', 'travel tips', 'where to go', 'trip ideas', 'vacation planning',
      'getaway', 'travel plan ideas',
    ],
  },
  {
    slug: 'event-planner',
    name: 'Event Planner',
    description: 'Plan an event, party, or gathering.',
    icon: '🎉',
    category: 'Leisure & Events',
    keywords: [
      'party', 'celebration', 'wedding', 'birthday', 'event planning', 'party ideas',
      'party planner', 'gathering', 'celebration ideas', 'event ideas', 'party theme',
      'guest list', 'event checklist', 'baby shower', 'anniversary', 'hen do', 'stag do',
      'party planning', 'graduation party', 'reunion',
    ],
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
    keywords: [
      'current affairs', 'headlines', 'news summary', "what's happening", "today's news",
      'breaking news', 'current events', 'world news', 'latest news', 'news update',
      'topic summary', 'news explained', 'politics news', 'world events', 'trending news',
      'news today', 'news roundup', 'explain the news', 'current news topic', 'news digest',
    ],
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
    keywords: [
      'repair', 'fix', 'household', 'appliance', 'leak', 'broken', 'home repair', 'diy fix',
      'household problem', 'home maintenance', 'plumbing', 'electrical', 'appliance repair',
      'broken appliance', 'home improvement', 'fix it', 'handyman', 'home issue', 'leaking tap',
      'boiler',
    ],
  },
  {
    slug: 'car',
    name: 'Car',
    description: 'Get help with a car problem.',
    icon: '🚗',
    category: 'How-to & Fixes',
    warning:
      "This isn't professional advice, for brakes, steering, or other safety-critical parts, visit your local garage.",
    keywords: [
      'vehicle', 'mechanic', 'engine', 'garage', 'mot', 'car problem', 'car trouble',
      'car repair', 'car noise', 'warning light', 'car issue', 'breakdown', 'tyre', 'brake',
      'car maintenance', 'car service', 'mechanic advice', 'car diagnostic', 'dashboard light',
      "car won't start",
    ],
  },
  {
    slug: 'diy',
    name: 'DIY',
    description: 'Get step-by-step DIY guidance.',
    icon: '🔨',
    category: 'How-to & Fixes',
    keywords: [
      'build', 'project', 'tools', 'repair', 'fix', 'diy project', 'home improvement',
      'building', 'construction', 'how to build', 'diy guide', 'diy help', 'weekend project',
      'diy tips', 'fix it yourself', 'handyman', 'renovation', 'woodworking', 'painting',
      'shelving',
    ],
  },
  {
    slug: 'tech',
    name: 'Tech',
    description: 'Get help fixing a tech problem.',
    icon: '💻',
    category: 'How-to & Fixes',
    keywords: [
      'computer', 'phone', 'wifi', 'software', 'device', 'laptop', 'tech problem', 'tech support',
      'troubleshoot', 'troubleshooting', 'app', 'internet', 'network', 'printer', 'tech help',
      'gadget', 'tech issue', 'computer problem', 'phone problem', 'fix my phone',
      'fix my computer',
    ],
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

// One lowercase "name + description + keywords" blob per tool, built once
// here at module load rather than on every keystroke in Home's search box
// — with ~30 tools a fresh scan is already cheap, but there's no reason to
// repeat the toLowerCase()/join() work every render when the tool list
// itself never changes at runtime.
const searchBlobs = new Map<string, string>(
  visibleTools.map((tool) => [
    tool.slug,
    [tool.name, tool.description, ...(tool.keywords ?? [])].join(' ').toLowerCase(),
  ]),
)

// Splits the query into words and requires every word to appear SOMEWHERE
// in a tool's blob — order-independent ("recommendations film" matches Film
// Recommendations same as "film recommendations") and substring-based, so a
// partial word like "rec" still matches "recommendations". No typo
// tolerance — deliberately simple, not a fuzzy search.
export function searchTools(query: string): Tool[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return visibleTools.filter((tool) => {
    const blob = searchBlobs.get(tool.slug) ?? ''
    return words.every((word) => blob.includes(word))
  })
}
