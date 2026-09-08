import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, ChevronRight, Minimize2, MoreVertical, Plus, Sparkles, Star } from 'lucide-react'
import { getTool } from '../tools/registry'
import { isToolSaved, toggleSavedTool } from '../lib/savedTools'
import { getChatsForTool } from '../lib/chats'
import { deleteItem, getItemsForTool, type Item } from '../lib/items'
import { getItemView } from '../tools/itemViews'
import ItemDetailModal from '../components/ItemDetailModal'
import Skeleton from '../components/Skeleton'
import { useAuth } from '../hooks/useAuth'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

const tabs = ['Items', 'Chats', 'Examples'] as const
type Tab = (typeof tabs)[number]

// These tools' items carry a lot more per-card content (genre, summary,
// rating) than a word-helper item — cramped into 2 columns it clips
// awkwardly, so they get one card per row instead.
const DENSE_ITEM_TOOLS = new Set(['film-recommendations', 'book-recommendations', 'quote-finder', 'story-explainer'])

function ToolDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const tool = slug ? getTool(slug) : undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const keyboardInset = useKeyboardInset()
  const [tab, setTab] = useState<Tab>('Items')
  const [isSaved, setIsSaved] = useState(() => (tool ? isToolSaved(tool.slug) : false))
  const [isComposing, setIsComposing] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null)
  const itemsGridClassName =
    tool && DENSE_ITEM_TOOLS.has(tool.slug) ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4'

  const { data: chats = [], isLoading: isChatsLoading } = useQuery({
    queryKey: ['chats', tool?.slug],
    queryFn: () => getChatsForTool(tool!.slug),
    enabled: !!tool && !!user,
  })

  const { data: items = [], isLoading: isItemsLoading } = useQuery({
    queryKey: ['items', tool?.slug],
    queryFn: () => getItemsForTool(tool!.slug),
    enabled: !!tool && !!user,
  })

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', tool?.slug] })
      setOpenItemMenuId(null)
    },
  })

  function handleToggleSave() {
    if (!tool) return
    setIsSaved(toggleSavedTool(tool.slug))
  }

  function handleOpenCompose() {
    setIsComposing(true)
  }

  function handleSend() {
    if (!message.trim() || !tool) return
    // The chat doesn't exist yet — Chat.tsx creates it (and shows the
    // normal generating-reply UI) as soon as it lands on "new" with this
    // message, rather than this page waiting on it itself.
    navigate(`/tools/${tool.slug}/chats/new`, { state: { firstMessage: message } })
  }

  return (
    <main className="px-4 py-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/')} aria-label="Back to home" className="text-2xl text-slate-900">
          ←
        </button>
        <h1 className="font-display text-xl font-semibold text-slate-900">{tool?.name ?? 'Tool'}</h1>
        <button
          type="button"
          onClick={handleToggleSave}
          aria-label={isSaved ? 'Remove from saved tools' : 'Save this tool'}
          className="ml-auto text-slate-400"
        >
          <Star className={`h-5 w-5 ${isSaved ? 'fill-amber-400 text-amber-400' : ''}`} strokeWidth={1.75} />
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-600">{tool?.description}</p>

      {user && isChatsLoading ? (
        // Reserves the "Continue chat" card's space while we don't yet
        // know if there'll be one — swapping straight from nothing to a
        // populated card (or the reverse) is what caused the page-jump.
        <div className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Continue chat</h2>
          <Skeleton className="mt-3 h-20" />
        </div>
      ) : (
        chats.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Continue chat</h2>
            <Link
              to={`/tools/${tool?.slug}/chats/${chats[0].id}`}
              className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{chats[0].title}</p>
                {chats[0].lastMessagePreview && (
                  <p className="mt-1 truncate text-sm text-slate-500">{chats[0].lastMessagePreview}</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={1.75} />
            </Link>
          </div>
        )
      )}

      <div className="mt-8 flex border-b border-slate-200">
        {tabs.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(label)}
            className={`flex-1 border-b-2 py-2.5 text-sm font-semibold transition ${
              tab === label ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8 text-sm text-slate-500">
        {tab === 'Items' &&
          (isItemsLoading ? (
            <div className={itemsGridClassName}>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : items.length === 0 ? (
            <p>No items saved yet. Anything worth keeping from a chat will show up here.</p>
          ) : (
            <div className={itemsGridClassName}>
              {items.map((item) => {
                const ItemView = getItemView(item.toolSlug)
                return (
                  <div key={item.id} className="relative">
                    <button type="button" onClick={() => setSelectedItem(item)} className="block w-full text-left">
                      <ItemView title={item.title} data={item.data} />
                    </button>

                    <div className="absolute right-2 top-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setOpenItemMenuId((current) => (current === item.id ? null : item.id))
                        }}
                        aria-label="More options"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm"
                      >
                        <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
                      </button>

                      {openItemMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white py-1 shadow-md">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              deleteItemMutation.mutate(item.id)
                            }}
                            disabled={deleteItemMutation.isPending}
                            className="whitespace-nowrap px-4 py-2 text-left text-sm font-medium text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        {tab === 'Chats' &&
          (isChatsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : chats.length === 0 ? (
            <p>No chats yet. Start one to see it here.</p>
          ) : (
            <div className="space-y-2">
              {chats.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/tools/${tool?.slug}/chats/${chat.id}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{chat.title}</p>
                    {chat.lastMessagePreview && (
                      <p className="mt-1 truncate text-sm text-slate-500">{chat.lastMessagePreview}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-xs text-slate-400">
                    {new Date(chat.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        {tab === 'Examples' && <p>Example use cases for this tool will show up here.</p>}
      </div>

      <button
        type="button"
        onClick={handleOpenCompose}
        aria-label="Start a new chat"
        className="fixed bottom-20 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700"
      >
        <Sparkles className="h-7 w-7" strokeWidth={1.75} />
      </button>

      {isComposing && (
        // fixed, not absolute — see ItemDetailModal for why (pins to the
        // real viewport instead of the whole scrollable page). Bottom
        // padding tracks the on-screen keyboard (h-[100dvh] doesn't shrink
        // for it on iOS) so the send button lands above it, not underneath.
        <div
          className="fixed inset-x-0 top-0 z-50 mx-auto flex h-[100dvh] max-w-md flex-col bg-white"
          style={{ paddingBottom: keyboardInset }}
        >
          <div className="flex justify-end px-4 pt-4">
            <button
              type="button"
              onClick={() => setIsComposing(false)}
              aria-label="Collapse"
              className="text-slate-400"
            >
              <Minimize2 className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>

          <textarea
            autoFocus
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`How can ${tool?.name ?? 'this tool'} help you today?`}
            className="flex-1 resize-none px-6 py-2 text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              aria-label="Attach an image"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500"
            >
              <Plus className="h-5 w-5" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              disabled={!message.trim()}
              onClick={handleSend}
              aria-label="Send"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </main>
  )
}

export default ToolDashboard
