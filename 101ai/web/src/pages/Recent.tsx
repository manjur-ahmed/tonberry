import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { getAllChats } from '../lib/chats'
import { getAllItems } from '../lib/items'
import { getTool } from '../tools/registry'
import { useAuth } from '../hooks/useAuth'

// Chats and Items are different shapes with different routes, so they're
// normalized into this common shape before being merged and sorted — a
// hideChatsTab tool (currently just Writer/Notes) never creates a chat, so
// without this its activity would never show up here at all.
interface RecentEntry {
  key: string
  toolSlug: string
  title: string
  preview: string | null
  updatedAt: string
  href: string
}

function Recent() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: chats = [], error: chatsError, refetch: refetchChats } = useQuery({
    queryKey: ['chats'],
    queryFn: getAllChats,
    enabled: !!user,
  })
  const { data: items = [], error: itemsError, refetch: refetchItems } = useQuery({
    queryKey: ['items'],
    queryFn: getAllItems,
    enabled: !!user,
  })

  const chatEntries: RecentEntry[] = chats.map((chat) => ({
    key: `chat-${chat.id}`,
    toolSlug: chat.toolSlug,
    title: chat.title,
    preview: chat.lastMessagePreview,
    updatedAt: chat.updatedAt,
    href: `/tools/${chat.toolSlug}/chats/${chat.id}`,
  }))

  // Every other tool's items are backed by a chat (already covered above) —
  // only a hideChatsTab tool's items need adding here.
  const itemEntries: RecentEntry[] = items
    .filter((item) => getTool(item.toolSlug)?.hideChatsTab)
    .map((item) => ({
      key: `item-${item.id}`,
      toolSlug: item.toolSlug,
      title: item.title,
      preview: null,
      updatedAt: item.updatedAt,
      href: `/tools/${item.toolSlug}/notes/${item.id}`,
    }))

  const entries = [...chatEntries, ...itemEntries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  const error = chatsError || itemsError
  function retry() {
    refetchChats()
    refetchItems()
  }

  return (
    <main className="px-4 py-6">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-slate-900">
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-900">Recent</h1>

      {error ? (
        <div className="mt-2">
          <p className="text-red-600">Couldn't load your recent activity.</p>
          <button type="button" onClick={retry} className="mt-2 text-sm font-semibold text-slate-900 underline">
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-slate-600">Your recently used tools will show up here.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {entries.map((entry) => {
            const tool = getTool(entry.toolSlug)
            return (
              <Link
                key={entry.key}
                to={entry.href}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <span className="text-2xl">{tool?.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {tool?.name ?? entry.toolSlug}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{entry.title}</p>
                  {entry.preview && (
                    <p className="mt-1 truncate text-sm text-slate-500">{entry.preview}</p>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs text-slate-400">
                  {new Date(entry.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default Recent
