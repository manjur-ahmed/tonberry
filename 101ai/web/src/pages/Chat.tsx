import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Info, Plus } from 'lucide-react'
import { getTool } from '../tools/registry'
import { useAuth } from '../hooks/useAuth'
import { addMessage, createChat, getChat, type Chat as ChatData } from '../lib/chats'
import { delay } from '../lib/delay'
import { getLoadingDuration } from '../tools/loadingStages'
import { hasSeenItemLimitNotice, markItemLimitNoticeSeen } from '../lib/itemLimitNotice'
import RedirectSuggestion from '../components/RedirectSuggestion'
import MessageActions from '../components/MessageActions'
import GeneratingResponse from '../components/GeneratingResponse'
import ItemLimitBanner from '../components/ItemLimitBanner'
import { getResponseView, type SaveStatus } from '../tools/responseViews'

const MAX_TEXTAREA_HEIGHT = 88 // ~4 lines at text-sm
const NEAR_BOTTOM_THRESHOLD = 80 // px

// The app's scroll context is the window itself (see Layout.tsx / BottomNav's
// own `sticky bottom-0`) — there's no bounded inner container to scroll, so
// this page pins its compose bar the same way BottomNav pins itself, and
// tracks window scroll instead of an isolated element's.
function scrollWindowToBottom(behavior: ScrollBehavior = 'auto') {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior })
}

function Chat() {
  const { slug, chatId } = useParams<{ slug: string; chatId: string }>()
  const location = useLocation()
  const tool = slug ? getTool(slug) : undefined
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ToolDashboard hands off a freshly-typed first message via router state
  // rather than creating the chat itself — that way the very first reply
  // gets the same optimistic-bubble + generating-stages treatment as every
  // later message, instead of a separate full-page loader on the dashboard.
  const isNewChat = chatId === 'new'
  const firstMessage = isNewChat ? (location.state as { firstMessage?: string } | null)?.firstMessage : undefined
  const hasStartedNewChatRef = useRef(false)

  const [draft, setDraft] = useState('')
  const [redirectSuggestion, setRedirectSuggestion] = useState<string | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({})
  const [itemLimitNoticeMessageId, setItemLimitNoticeMessageId] = useState<string | null>(null)

  function handleSaveStatusChange(messageId: string, status: SaveStatus) {
    setSaveStatuses((current) => ({ ...current, [messageId]: status }))
    // Once shown for this chat, never show it again — even if another
    // message in the same chat also hits the limit.
    if (status === 'limit-reached' && chatId && !hasSeenItemLimitNotice(chatId)) {
      markItemLimitNoticeSeen(chatId)
      setItemLimitNoticeMessageId(messageId)
    }
  }

  const { data: chat, isLoading } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId!),
    enabled: !!chatId && !isNewChat,
  })

  const hasMemory = user?.plan === 'plus' || user?.plan === 'premium'

  useEffect(() => {
    function handleScroll() {
      const distanceFromBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight
      setIsAtBottom(distanceFromBottom < NEAR_BOTTOM_THRESHOLD)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Jump to the latest message as soon as a chat loads.
  useEffect(() => {
    if (chat) requestAnimationFrame(() => scrollWindowToBottom())
  }, [chat?.id])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [draft])

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const result = isNewChat ? await createChat(tool!.slug, content) : await addMessage(chatId!, content)
      // No real API latency yet (see openai.service.ts) — hold the reply so
      // the fake "generating" stages below get a beat on screen instead of
      // flashing in and out instantly.
      await delay(getLoadingDuration(tool!.slug))
      return result
    },
    // Shows the user's own message immediately rather than waiting on the
    // (now artificially delayed) round trip — reverted below if the router
    // redirects instead of actually saving it to this chat.
    onMutate: (content: string) => {
      const previous = queryClient.getQueryData<ChatData>(['chat', chatId])
      if (previous) {
        queryClient.setQueryData<ChatData>(['chat', chatId], {
          ...previous,
          messages: [
            ...previous.messages,
            { id: `optimistic-${Date.now()}`, role: 'user', content, createdAt: new Date().toISOString() },
          ],
        })
      }
      return { previous }
    },
    onSuccess: (result, _content, context) => {
      if (result.type === 'redirect') {
        if (context?.previous) queryClient.setQueryData(['chat', chatId], context.previous)
        setRedirectSuggestion(result.suggestedTool)
        return
      }
      if (isNewChat) {
        // Swap "new" for the real chat id the backend just assigned —
        // seeding its cache first means this navigation doesn't cause a
        // fresh loading flash, it just picks up where "new" left off.
        queryClient.setQueryData(['chat', result.chat.id], result.chat)
        navigate(`/tools/${tool!.slug}/chats/${result.chat.id}`, { replace: true })
      } else {
        queryClient.setQueryData(['chat', chatId], result.chat)
        requestAnimationFrame(() => scrollWindowToBottom('smooth'))
      }
    },
    onError: (_error, content, context) => {
      if (context?.previous) queryClient.setQueryData(['chat', chatId], context.previous)
      if (isNewChat) {
        navigate(`/tools/${tool!.slug}/dashboard`, { replace: true })
      } else {
        setDraft(content)
      }
    },
  })

  // Kick off the first message as soon as we land here — before paint, so
  // there's no flash of an empty/loading chat before the optimistic bubble
  // and generating indicator appear.
  useLayoutEffect(() => {
    if (!isNewChat || hasStartedNewChatRef.current) return
    if (!firstMessage || !tool) {
      navigate(tool ? `/tools/${tool.slug}/dashboard` : '/', { replace: true })
      return
    }
    hasStartedNewChatRef.current = true
    queryClient.setQueryData<ChatData>(['chat', 'new'], {
      id: 'new',
      toolSlug: tool.slug,
      title: '',
      lastMessagePreview: null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    sendMutation.mutate(firstMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSend() {
    if (!draft.trim() || !chatId) return
    sendMutation.mutate(draft)
    setDraft('')
    requestAnimationFrame(() => scrollWindowToBottom('smooth'))
  }

  if (!tool || (isNewChat ? !chat : isLoading)) {
    return (
      <main className="px-4 py-6">
        <p className="text-slate-600">Loading...</p>
      </main>
    )
  }

  if (!chat) {
    return (
      <main className="px-4 py-6">
        <p className="text-slate-600">Chat not found.</p>
      </main>
    )
  }

  const ResponseView = getResponseView(tool.slug)

  return (
    <main className="px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/tools/${tool.slug}/dashboard`)}
            aria-label="Back to tool"
            className="text-2xl text-slate-900"
          >
            ←
          </button>
          <h1 className="font-display text-xl font-semibold text-slate-900">{tool.name}</h1>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400">
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
        Memory {hasMemory ? 'on' : 'off'}
        {!hasMemory && (
          <>
            {' — '}
            <Link to="/settings" className="underline">
              turn on
            </Link>
          </>
        )}
      </div>

      <div className="mt-3 space-y-4">
        {chat.messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-900">
                {message.content}
              </p>
            </div>
          ) : (
            <div key={message.id}>
              <ResponseView
                content={message.content}
                toolSlug={tool.slug}
                chatId={chat.id}
                messageId={message.id}
                onSaveStatusChange={(status) => handleSaveStatusChange(message.id, status)}
              />
              <MessageActions content={message.content} saveStatus={saveStatuses[message.id]} />
              {itemLimitNoticeMessageId === message.id && <ItemLimitBanner />}
            </div>
          ),
        )}

        {sendMutation.isPending && (
          <div>
            <GeneratingResponse toolSlug={tool.slug} />
          </div>
        )}
      </div>

      {/* Pinned above BottomNav (64px) the same way BottomNav pins itself
          to the viewport — see the scroll-context note above. */}
      <div className="sticky bottom-16 z-10 mt-8">
        {!isAtBottom && (
          <button
            type="button"
            onClick={() => scrollWindowToBottom('smooth')}
            aria-label="Scroll to latest"
            className="absolute -top-14 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={2} />
          </button>
        )}

        {redirectSuggestion ? (
          <RedirectSuggestion toolSlug={redirectSuggestion} onDismiss={() => setRedirectSuggestion(null)} />
        ) : (
          <div
            className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
            onClick={() => textareaRef.current?.focus()}
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={`How can ${tool.name} help you today?`}
              rows={1}
              className="w-full resize-none overflow-y-auto bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                aria-label="Attach an image"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                disabled={!draft.trim() || sendMutation.isPending}
                onClick={(event) => {
                  event.stopPropagation()
                  handleSend()
                }}
                aria-label="Send"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default Chat
