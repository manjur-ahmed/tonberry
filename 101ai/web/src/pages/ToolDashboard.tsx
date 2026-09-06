import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Minimize2, MoreVertical, Plus, Sparkles, Star } from 'lucide-react'
import { getTool } from '../tools/registry'
import { isToolSaved, toggleSavedTool } from '../lib/savedTools'
import { createChat, getChatsForTool } from '../lib/chats'
import { deleteItem, getItemsForTool, type Item } from '../lib/items'
import { getItemView } from '../tools/itemViews'
import RedirectSuggestion from '../components/RedirectSuggestion'
import ItemDetailModal from '../components/ItemDetailModal'

const tabs = ['Items', 'Chats', 'Examples'] as const
type Tab = (typeof tabs)[number]

function ToolDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const tool = slug ? getTool(slug) : undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('Items')
  const [isSaved, setIsSaved] = useState(() => (tool ? isToolSaved(tool.slug) : false))
  const [isComposing, setIsComposing] = useState(false)
  const [message, setMessage] = useState('')
  const [redirectSuggestion, setRedirectSuggestion] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null)

  const { data: chats = [] } = useQuery({
    queryKey: ['chats', tool?.slug],
    queryFn: () => getChatsForTool(tool!.slug),
    enabled: !!tool,
  })

  const { data: items = [] } = useQuery({
    queryKey: ['items', tool?.slug],
    queryFn: () => getItemsForTool(tool!.slug),
    enabled: !!tool,
  })

  const sendMutation = useMutation({
    mutationFn: () => createChat(tool!.slug, message),
    onSuccess: (result) => {
      if (result.type === 'redirect') {
        setRedirectSuggestion(result.suggestedTool)
      } else {
        navigate(`/tools/${tool!.slug}/chats/${result.chat.id}`)
      }
    },
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
    setRedirectSuggestion(null)
    setIsComposing(true)
  }

  function handleSend() {
    if (!message.trim() || !tool) return
    sendMutation.mutate()
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
          (items.length === 0 ? (
            <p>No items saved yet. Anything worth keeping from a chat will show up here.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
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
          (chats.length === 0 ? (
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
        <div className="absolute inset-0 z-50 flex flex-col bg-white">
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

          {redirectSuggestion ? (
            <div className="flex flex-1 items-center justify-center px-6">
              <RedirectSuggestion toolSlug={redirectSuggestion} onDismiss={() => setRedirectSuggestion(null)} />
            </div>
          ) : (
            <>
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
                  disabled={!message.trim() || sendMutation.isPending}
                  onClick={handleSend}
                  aria-label="Send"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white disabled:opacity-40"
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </main>
  )
}

export default ToolDashboard
