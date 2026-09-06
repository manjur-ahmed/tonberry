import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import ToolCard from '../components/ToolCard'
import ProgressRing from '../components/ProgressRing'
import { categories, getTool, tools, type Tool } from '../tools/registry'
import { useAuth } from '../hooks/useAuth'
import { getSavedSlugs } from '../lib/savedTools'
import { getPlan, plans } from '../lib/plans'

function Home() {
  const { user, isLoading } = useAuth()
  const showHero = !isLoading && !user
  const [query, setQuery] = useState('')
  const [savedSlugs] = useState(() => getSavedSlugs())
  const [showChatsTooltip, setShowChatsTooltip] = useState(false)

  // The browser (Chrome/Safari alike) can restore a suspended tab at its
  // last scroll position instead of loading fresh — force the top on landing.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Chat usage isn't tracked anywhere yet (no chat feature exists), so this
  // always renders as an empty ring until real usage data feeds it.
  const dailyChatsUsed = 0
  const dailyChatLimit = (getPlan(user?.plan) ?? plans[0]).dailyChats
  const chatsRemaining = dailyChatLimit - dailyChatsUsed

  const isSearching = query.trim().length > 0
  const savedTools = savedSlugs.map((slug) => getTool(slug)).filter((tool): tool is Tool => !!tool)

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return tools.filter(
      (tool) => tool.name.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <main>
      {showHero && (
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-100 via-violet-50 to-white px-4 pb-10 pt-16">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
          <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />

          <h1 className="relative font-display text-4xl font-semibold leading-tight text-slate-900">
            Welcome, jump right in
          </h1>

          <div className="relative mt-8 flex flex-row gap-3">
            <Link
              to="/sign-in?mode=signup"
              className="flex-1 rounded-full bg-slate-900 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
            >
              Create an account
            </Link>
            <Link
              to="/sign-in"
              className="flex-1 rounded-full border border-slate-300 bg-white/70 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-white"
            >
              Sign in
            </Link>
          </div>
        </section>
      )}

      <div className="px-4 py-10">
        {user && (
          <div className="mb-6 flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold leading-tight text-slate-900">
              Hi,
              <br />
              ready when you are
            </h1>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowChatsTooltip((value) => !value)}
                aria-label="Daily chats remaining"
              >
                <ProgressRing progress={dailyChatsUsed / dailyChatLimit} />
              </button>
              {showChatsTooltip && (
                <div className="absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                  {chatsRemaining} chats remaining today
                </div>
              )}
            </div>
          </div>
        )}

        {savedTools.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-2xl font-semibold text-slate-900">Saved</h2>
            <div className="-mx-4 mt-4 flex gap-6 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {savedTools.map((tool) => (
                <div key={tool.slug} className="h-[170px] w-[170px] flex-shrink-0">
                  <ToolCard tool={tool} />
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="font-display text-2xl font-semibold text-slate-900">Browse Tools</h2>

        <div className="relative mt-4">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {isSearching ? (
          <div className="mt-6 grid grid-cols-2 gap-4">
            {searchResults.map((tool) => (
              <div key={tool.slug} className="h-[170px] w-[170px]">
                <ToolCard tool={tool} />
              </div>
            ))}
            {searchResults.length === 0 && (
              <p className="col-span-2 text-sm text-slate-500">No tools found.</p>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {categories.map((category) => {
              const items = tools.filter((tool) => tool.category === category)
              if (items.length === 0) return null

              return (
                <div key={category}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {category}
                  </h3>
                  <div className="-mx-4 mt-3 flex gap-6 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {items.map((tool) => (
                      <div key={tool.slug} className="h-[170px] w-[170px] flex-shrink-0">
                        <ToolCard tool={tool} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default Home
