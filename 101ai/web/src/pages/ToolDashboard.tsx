import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowUp, ChevronRight, ChevronUp, Minimize2, Plus, Sparkles, Star, Trash2 } from 'lucide-react'
import { getTool, type ComposeOption } from '../tools/registry'
import { isToolSaved, toggleSavedTool } from '../lib/savedTools'
import { getChatsForTool } from '../lib/chats'
import { deleteItem, getItemsForTool, type Item } from '../lib/items'
import { generateContent } from '../lib/generate'
import { getItemView } from '../tools/itemViews'
import ItemDetailModal from '../components/ItemDetailModal'
import OptionsMenu from '../components/OptionsMenu'
import Skeleton from '../components/Skeleton'
import ToolNotice from '../components/ToolNotice'
import { useAuth } from '../hooks/useAuth'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

const tabs = ['Items', 'Chats', 'Examples'] as const
type Tab = (typeof tabs)[number]

// These tools' items carry a lot more per-card content (genre, summary,
// rating) than a word-helper item — cramped into 2 columns it clips
// awkwardly, so they get one card per row instead.
const DENSE_ITEM_TOOLS = new Set([
  'film-recommendations',
  'book-recommendations',
  'quote-finder',
  'story-explainer',
  'science-explainer',
  'history-helper',
  'cooking',
  'diet',
  'self-care',
  'tech',
  'politics',
  'home',
  'car',
  'diy',
  'general-health',
  'gym-planner',
  'business-plan',
  'business-research',
  'salary-calculator',
  'day-activity',
  'holiday-planning',
  'event-planner',
  'ad-creator',
  'career-planner',
  'budget-planner',
  'writer',
])

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
  const [isComposeMenuOpen, setIsComposeMenuOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const itemsGridClassName =
    tool && DENSE_ITEM_TOOLS.has(tool.slug) ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-2 gap-4'
  const visibleTabs = tool?.hideChatsTab ? tabs.filter((label) => label !== 'Chats') : tabs

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
    },
  })

  // Only used by a hideChatsTab tool's compose sheet (currently just
  // writer) — no chat thread involved, the reply becomes the new note's
  // body directly (see NoteEditor.tsx).
  const generateMutation = useMutation({
    mutationFn: (prompt: string) => generateContent(tool!.slug, prompt),
    onSuccess: (draft) => {
      setIsComposing(false)
      setMessage('')
      navigate(`/tools/${tool?.slug}/notes/new`, {
        state: { initialBody: draft.content, initialTitle: draft.title },
      })
    },
  })

  function handleToggleSave() {
    if (!tool) return
    setIsSaved(toggleSavedTool(tool.slug))
  }

  function handleOpenCompose() {
    setIsComposeMenuOpen(false)
    setIsComposing(true)
  }

  function handleFabClick() {
    if (tool?.multiActionCompose) {
      setIsComposeMenuOpen((open) => !open)
      return
    }
    handleOpenCompose()
  }

  function handleComposeOption(action: ComposeOption['action']) {
    if (action === 'note') {
      setIsComposeMenuOpen(false)
      navigate(`/tools/${tool?.slug}/notes/new`)
      return
    }
    handleOpenCompose()
  }

  function handleSend() {
    if (!message.trim() || !tool) return
    if (tool.hideChatsTab) {
      // No chat thread for this tool — the compose sheet only ever opens
      // via the "Generate with AI" option (see handleComposeOption), so
      // sending here always means "generate note content", never a chat.
      generateMutation.mutate(message)
      return
    }
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

      {tool?.hideChatsTab ? (
        // Writer has no chat thread to continue — its "continue" card
        // points at the most recently edited item instead (items are
        // already returned updatedAt DESC, see ItemsService), and opens it
        // straight into the editable NoteEditor rather than the read-only
        // item detail sheet the Items grid falls back to for every other
        // tool.
        user && isItemsLoading ? (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Continue Writing</h2>
            <Skeleton className="mt-3 h-20" />
          </div>
        ) : (
          items.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Continue Writing</h2>
              <button
                type="button"
                onClick={() => navigate(`/tools/${tool.slug}/notes/${items[0].id}`)}
                className="mt-3 flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{items[0].title}</p>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={1.75} />
              </button>
            </div>
          )
        )
      ) : user && isChatsLoading ? (
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
        {visibleTabs.map((label) => (
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
                    <button
                      type="button"
                      onClick={() =>
                        // Writer's items are notes — open the real editor,
                        // not the read-only detail sheet every other tool
                        // uses.
                        tool?.hideChatsTab
                          ? navigate(`/tools/${tool.slug}/notes/${item.id}`)
                          : setSelectedItem(item)
                      }
                      className="block w-full text-left"
                    >
                      <ItemView title={item.title} data={item.data} />
                    </button>

                    <div className="absolute right-2 top-2">
                      <OptionsMenu
                        items={[
                          {
                            label: 'Delete',
                            icon: Trash2,
                            tone: 'danger',
                            disabled: deleteItemMutation.isPending,
                            onClick: () => deleteItemMutation.mutate(item.id),
                          },
                        ]}
                      />
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

      {tool?.multiActionCompose && isComposeMenuOpen && (
        <div
          onClick={() => setIsComposeMenuOpen(false)}
          className="fixed inset-0 z-30 mx-auto max-w-md bg-gradient-to-t from-white via-white/90 to-transparent"
        />
      )}

      {tool?.multiActionCompose && isComposeMenuOpen && (
        <div className="fixed bottom-40 right-4 z-40 flex flex-col items-end gap-2">
          {tool.composeOptions?.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => handleComposeOption(option.action)}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-md hover:bg-slate-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleFabClick}
        aria-label={tool?.composeLabel ?? 'New Chat'}
        className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full px-6 py-4 shadow-lg transition-colors ${
          tool?.multiActionCompose && isComposeMenuOpen
            ? 'bg-white text-violet-600 hover:bg-slate-50'
            : 'bg-violet-600 text-white hover:bg-violet-700'
        }`}
      >
        <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        <span className="text-sm font-semibold">{tool?.composeLabel ?? 'New Chat'}</span>
        {tool?.multiActionCompose && (
          <ChevronUp
            className={`h-4 w-4 transition-transform ${isComposeMenuOpen ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        )}
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

          {tool?.warning && (
            <div className="px-4">
              <ToolNotice icon={AlertTriangle} message={tool.warning} />
            </div>
          )}

          {generateMutation.isError && (
            <p className="px-4 text-sm text-red-600">Couldn&rsquo;t generate that — try again.</p>
          )}

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
              disabled={!message.trim() || generateMutation.isPending}
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
