import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Brain, Info, Plus } from 'lucide-react'
import { getTool } from '../tools/registry'
import { useAuth } from '../hooks/useAuth'
import { addMessage, createChat, getChat, type Chat as ChatData, type ChatMessage } from '../lib/chats'
import { delay } from '../lib/delay'
import { getLoadingDuration } from '../tools/loadingStages'
import { hasSeenItemLimitNotice, markItemLimitNoticeSeen } from '../lib/itemLimitNotice'
import RedirectSuggestion from '../components/RedirectSuggestion'
import MessageActions from '../components/MessageActions'
import GeneratingResponse from '../components/GeneratingResponse'
import ItemLimitBanner from '../components/ItemLimitBanner'
import ToolNotice from '../components/ToolNotice'
import { getResponseView, type SaveStatus } from '../tools/responseViews'
import { getItemView } from '../tools/itemViews'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

const MAX_TEXTAREA_HEIGHT = 88 // ~4 lines at text-sm
const NEAR_BOTTOM_THRESHOLD = 80 // px

// The app's scroll context is the window itself (see Layout.tsx / BottomNav's
// own `sticky bottom-0`) — there's no bounded inner container to scroll, so
// this page pins its compose bar the same way BottomNav pins itself, and
// tracks window scroll instead of an isolated element's.
function scrollWindowToBottom(behavior: ScrollBehavior = 'auto') {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior })
}

// Item-card messages are always server-generated JSON (see
// ChatsService.createChatFromItem) — the try/catch is defensive, not
// expected to trigger.
function parseItemCardData(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

// Rendered with the item's *own* tool (message.itemToolSlug), not
// necessarily this chat's tool — an item opened via "Open in another tool"
// still needs its origin tool's ItemView (e.g. a film item's title+year
// card) to make sense of `data`, since the chat's own tool may have no idea
// how to display it. Falls back to the chat's tool for a message saved
// before itemToolSlug existed, same as it did before this existed.
// ItemView already draws its own border/background/padding (see
// WordHelperItemView) — the wrapper here only adds the shadow, rather than
// nesting a second bordered box around it.
function ItemCardMessage({ message, chatToolSlug, chatToolName }: { message: ChatMessage; chatToolSlug: string; chatToolName: string }) {
  const ItemView = getItemView(message.itemToolSlug ?? chatToolSlug)
  return (
    <div className="rounded-2xl shadow-md shadow-slate-300/40">
      <ItemView title={message.itemTitle ?? chatToolName} data={parseItemCardData(message.content)} />
    </div>
  )
}

function Chat() {
  const { slug, chatId } = useParams<{ slug: string; chatId: string }>()
  const location = useLocation()
  const tool = slug ? getTool(slug) : undefined
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const keyboardInset = useKeyboardInset()

  // ToolDashboard hands off a freshly-typed first message via router state
  // rather than creating the chat itself — that way the very first reply
  // gets the same optimistic-bubble + generating-stages treatment as every
  // later message, instead of a separate full-page loader on the dashboard.
  const isNewChat = chatId === 'new'
  const firstMessage = isNewChat ? (location.state as { firstMessage?: string } | null)?.firstMessage : undefined
  const hasStartedNewChatRef = useRef(false)
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingScrollIdRef = useRef<string | null>(null)
  // Set right before the "new" -> real chat id swap below, so the
  // load-scroll effect can tell "we just created this chat" apart from
  // "the user navigated into an existing one" — both look like `chat?.id`
  // changing, but only the latter should jump to the bottom.
  const skipNextLoadScrollRef = useRef(false)

  const [draft, setDraft] = useState('')
  const [redirectSuggestion, setRedirectSuggestion] = useState<{ toolSlug: string; content: string } | null>(null)
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

  // Jump to the latest message as soon as an *existing* chat loads. Skipped
  // for a brand-new chat (isNewChat — there's no history to jump to yet,
  // and it would otherwise race the "scroll new message to top" effect
  // below) and skipped once right after we swap "new" for the real chat
  // id, which looks like the same "chat?.id changed" trigger but isn't a
  // real navigation.
  useEffect(() => {
    if (!chat) return
    if (skipNextLoadScrollRef.current) {
      skipNextLoadScrollRef.current = false
      return
    }
    if (isNewChat) return
    requestAnimationFrame(() => scrollWindowToBottom())
  }, [chat?.id])

  // After sending, scroll the new message to the top of the viewport rather
  // than jumping to the bottom of the page — a long reply (e.g. a full word
  // definition) should be read from its start, not land already scrolled
  // past the end of it.
  useEffect(() => {
    const id = pendingScrollIdRef.current
    if (!id) return
    // Cleared unconditionally (not only when found) — an id that never
    // resolves to a DOM node should be dropped, not left to potentially
    // misfire against some unrelated later message.
    pendingScrollIdRef.current = null
    const el = messageRefs.current[id]
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }, [chat?.messages])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [draft])

  const sendMutation = useMutation({
    mutationFn: async ({ content, skipRouter }: { content: string; skipRouter?: boolean }) => {
      const result = isNewChat
        ? await createChat(tool!.slug, content, skipRouter)
        : await addMessage(chatId!, content, skipRouter)
      // No real API latency yet (see openai.service.ts) — hold the reply so
      // the fake "generating" stages below get a beat on screen instead of
      // flashing in and out instantly.
      await delay(getLoadingDuration(tool!.slug))
      return result
    },
    // Shows the user's own message immediately rather than waiting on the
    // (now artificially delayed) round trip — reverted below if the router
    // redirects instead of actually saving it to this chat.
    onMutate: ({ content }: { content: string; skipRouter?: boolean }) => {
      const previous = queryClient.getQueryData<ChatData>(['chat', chatId])
      if (previous) {
        const optimisticId = `optimistic-${Date.now()}`
        queryClient.setQueryData<ChatData>(['chat', chatId], {
          ...previous,
          messages: [
            ...previous.messages,
            {
              id: optimisticId,
              role: 'user',
              content,
              isItemCard: false,
              itemTitle: null,
              itemToolSlug: null,
              createdAt: new Date().toISOString(),
            },
          ],
        })
        pendingScrollIdRef.current = optimisticId
      }
      return { previous }
    },
    onSuccess: (result, { content }, context) => {
      if (result.type === 'redirect') {
        if (context?.previous) queryClient.setQueryData(['chat', chatId], context.previous)
        setRedirectSuggestion({ toolSlug: result.suggestedTool, content })
        return
      }
      if (isNewChat) {
        // Swap "new" for the real chat id the backend just assigned —
        // seeding its cache first means this navigation doesn't cause a
        // fresh loading flash, it just picks up where "new" left off. This
        // makes chat?.id "change" the same way opening a different chat
        // does, so tell the load-scroll effect not to treat it as one.
        skipNextLoadScrollRef.current = true
        queryClient.setQueryData(['chat', result.chat.id], result.chat)
        navigate(`/tools/${tool!.slug}/chats/${result.chat.id}`, { replace: true })
      } else {
        queryClient.setQueryData(['chat', chatId], result.chat)
      }
    },
    onError: (_error, { content }, context) => {
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
    sendMutation.mutate({ content: firstMessage })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSend() {
    if (!draft.trim() || !chatId) return
    sendMutation.mutate({ content: draft })
    setDraft('')
  }

  // The router flagged this message as a better fit for another tool, but
  // the user chose to stay — resend the same message with skipRouter so it
  // doesn't just get redirected again. The AI may well decline it (see the
  // scope-guard system prompt in tool-config.ts), but that decline happens
  // in-chat rather than forcing a tool switch the user didn't ask for.
  function handleStayHere() {
    if (!redirectSuggestion) return
    sendMutation.mutate({ content: redirectSuggestion.content, skipRouter: true })
    setRedirectSuggestion(null)
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

  // Hides once the user's first REAL reply has come back — counting
  // userMessageCount instead would hide it too early to ever be seen: the
  // optimistic bubble in sendMutation's onMutate makes userMessageCount hit
  // 1 the instant a message is sent, before its reply (and the "Generating
  // response..." delay) even starts, so a `< 1` threshold on that would
  // leave no visible window at all. Counting real assistant replies instead
  // keeps it up through that whole generating phase and hides it right as
  // the reply lands — no dead flash, and no lingering through a second
  // exchange either.
  //
  // An item-started chat (see ChatsService.createChatFromItem) seeds 3
  // fixed messages up front — the item card, a canned "I want to talk about
  // this", and a canned "Sure, how can I help?" — none of which are a real
  // exchange, so they're excluded via isItemCard (only ever true on that
  // seeded first message) rather than counted as the user's first reply.
  const startedFromItem = chat.messages[0]?.isItemCard === true
  const realMessages = startedFromItem ? chat.messages.slice(3) : chat.messages
  const realAssistantReplyCount = realMessages.filter((message) => message.role === 'assistant').length
  const showMemoryPromo = tool.promoteMemory && !hasMemory && realAssistantReplyCount < 1

  return (
    // Extra bottom padding — the compose bar below is now `fixed`, so it no
    // longer reserves its own space in flow; this keeps the last message
    // from ending up hidden behind it. 224px is a static worst-case guess
    // (compose bar at its tallest, ~156px when the textarea's grown to
    // MAX_TEXTAREA_HEIGHT, plus the 64px gap above BottomNav it rests on)
    // rather than the compose bar's real measured height, so there's some
    // slack under the last message when the textarea is only one line.
    <main className="px-4 pb-56">
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
            <div
              key={message.id}
              ref={(el) => {
                messageRefs.current[message.id] = el
              }}
              // Clears the sticky header (~80px) so scrollIntoView's
              // block: 'start' doesn't land the message underneath it.
              className="flex scroll-mt-20 justify-end"
            >
              <p className="max-w-[80%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-900">
                {message.content}
              </p>
            </div>
          ) : message.isItemCard ? (
            <ItemCardMessage key={message.id} message={message} chatToolSlug={tool.slug} chatToolName={tool.name} />
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

      {/* fixed, not sticky — sticky's offset is computed against the layout
          viewport, which iOS doesn't shrink for the on-screen keyboard, so
          it ended up placing this (and the send button in it) underneath
          the keyboard instead of above it. bottom tracks the keyboard
          inset directly; bottom-16 (64px, matching BottomNav's height) is
          the resting position the rest of the time. mx-auto + max-w-md +
          px-4 replicate the horizontal placement `main`'s own padding gave
          it before it was taken out of flow. */}
      <div
        className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4"
        style={{ bottom: keyboardInset > 0 ? keyboardInset : undefined }}
      >
        {!isAtBottom && (
          <button
            type="button"
            onClick={() => scrollWindowToBottom('smooth')}
            aria-label="Scroll to latest"
            className="absolute -top-14 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md"
          >
            <ArrowDown className="h-4 w-4" strokeWidth={2} />
          </button>
        )}

        {/* Hidden once the keyboard's up (nothing left to nudge them about
            once they're already typing) and while the redirect suggestion
            — which has no reply box of its own — is showing instead. */}
        {showMemoryPromo && keyboardInset === 0 && !redirectSuggestion && (
          <ToolNotice
            icon={Brain}
            message={
              <>
                Psst&hellip; this tool works better with memory!{' '}
                <Link to="/settings" className="underline">
                  Enable memory
                </Link>
              </>
            }
          />
        )}

        {redirectSuggestion ? (
          <RedirectSuggestion toolSlug={redirectSuggestion.toolSlug} onStayHere={handleStayHere} />
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
              // text-base, not text-sm — iOS Safari auto-zooms the page on
              // focus for any input/textarea under 16px, which is why
              // sending a message used to leave the page zoomed in.
              className="w-full resize-none overflow-y-auto bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
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
