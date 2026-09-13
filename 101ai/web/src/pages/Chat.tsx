import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Brain, Camera, File as FileIcon, Image as ImageIcon, Info, Layers, Loader2, MapPin, X } from 'lucide-react'
import { getTool } from '../tools/registry'
import AttachmentMenu from '../components/AttachmentMenu'
import ItemPickerSheet from '../components/ItemPickerSheet'
import CompactItemCard from '../components/CompactItemCard'
import FileAttachmentChip from '../components/FileAttachmentChip'
import { useAuth } from '../hooks/useAuth'
import { addMessage, createChat, getChat, type Chat as ChatData, type ChatMessage, type GpsLocation } from '../lib/chats'
import {
  getCachedGpsLocation,
  queryGeolocationPermission,
  setCachedGpsLocation,
} from '../lib/stepsPlannerLocation'
import type { Item } from '../lib/items'
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  ALLOWED_UPLOAD_FILE_EXTENSIONS,
  MAX_UPLOAD_SIZE_BYTES,
  uploadAttachment,
  type UploadedAttachment,
} from '../lib/uploads'
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
const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE_BYTES / 1024 / 1024

interface SendVars {
  content: string
  skipRouter?: boolean
  attachments?: UploadedAttachment[]
  // Local blob urls for the optimistic bubble only (see sendMutation's
  // onMutate) — never sent to the backend. Same order/length as
  // `attachments` above.
  previewUrls?: string[]
  itemIds?: string[]
  // Full item snapshots for the optimistic bubble only (see onMutate) —
  // the backend re-resolves its own snapshot from itemIds, this is just so
  // the compact cards can render instantly without waiting on the round
  // trip. Same order as itemIds.
  attachedItems?: Item[]
  // Steps Planner only — the browser's geolocation result (see the
  // location banner below), sent alongside the message.
  gpsLocation?: GpsLocation
}

// One local id per pending upload (assigned at pick time, before the
// presign/PUT round trip even starts) — lets multiple files be in flight
// at once, each tracked/removed independently, instead of a single shared
// slot. previewUrl shows instantly from the local file; uploaded stays
// null until uploadMutation resolves for this specific id. filename/
// contentType are captured at pick time (not read off `uploaded`, which
// is null until the upload finishes) so the pending chip can show the
// right icon/name immediately — a photo vs. a PDF looks different from
// the moment it's picked, not just once it's finished uploading.
interface PendingAttachment {
  localId: string
  previewUrl: string
  filename: string
  contentType: string
  uploaded: UploadedAttachment | null
}

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
  const newChatState = isNewChat
    ? (location.state as {
        firstMessage?: string
        firstAttachments?: UploadedAttachment[]
        firstPreviewUrls?: string[]
        firstItemIds?: string[]
        firstAttachedItems?: Item[]
        firstGpsLocation?: GpsLocation
      } | null)
    : null
  const firstMessage = newChatState?.firstMessage
  const firstAttachments = newChatState?.firstAttachments
  const firstPreviewUrls = newChatState?.firstPreviewUrls
  const firstItemIds = newChatState?.firstItemIds
  const firstAttachedItems = newChatState?.firstAttachedItems
  const firstGpsLocation = newChatState?.firstGpsLocation
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
  // Populated only by a ResponseView that calls onCopyTextChange (see
  // ResponseViewProps) — everything else falls back to raw message.content
  // below, unchanged from before this existed.
  const [copyTexts, setCopyTexts] = useState<Record<string, string>>({})
  // Steps Planner only (see the location banner below) — null until the
  // user allows it (or this chat started with one already known, from
  // ToolDashboard's compose sheet). geolocationDenied hides the banner
  // after a decline/failure rather than nagging on every render — the
  // user can still type a named starting location instead.
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(
    () => firstGpsLocation ?? getCachedGpsLocation(),
  )
  const [geolocationDenied, setGeolocationDenied] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  // Multiple photos can be queued at once — no multi-select picker, the
  // user just reopens the attach menu again for each one, so each pick
  // appends here rather than replacing.
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  // A rejected pick (too big) — separate from uploadMutation's own error
  // state, since this never gets far enough to actually attempt an upload.
  const [fileError, setFileError] = useState<string | null>(null)
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false)
  // Saved items picked via the attach menu, waiting to go out with the next
  // message — full Item objects (not just ids) so the compact preview
  // cards can render immediately with no extra fetch. Same "reopen the
  // menu again" pattern as pendingAttachments — no multi-select UI.
  const [pendingItems, setPendingItems] = useState<Item[]>([])
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  function handleSaveStatusChange(messageId: string, status: SaveStatus) {
    setSaveStatuses((current) => ({ ...current, [messageId]: status }))
    // Once shown for this chat, never show it again — even if another
    // message in the same chat also hits the limit.
    if (status === 'limit-reached' && chatId && !hasSeenItemLimitNotice(chatId)) {
      markItemLimitNoticeSeen(chatId)
      setItemLimitNoticeMessageId(messageId)
    }
  }

  function handleCopyTextChange(messageId: string, text: string | null) {
    setCopyTexts((current) => {
      if (text === null) {
        if (!(messageId in current)) return current
        const { [messageId]: _removed, ...rest } = current
        return rest
      }
      return { ...current, [messageId]: text }
    })
  }

  // Steps Planner only — the browser's own permission prompt does the
  // actual asking; this just wires the result into state. A denial or a
  // browser without geolocation support both land in the same
  // "couldn't get it" bucket — the user can still type a named starting
  // location instead (see StepsPlannerService's fallback for that case).
  function handleAllowLocation() {
    if (!navigator.geolocation) {
      setGeolocationDenied(true)
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude }
        setIsLocating(false)
        setGpsLocation(location)
        setCachedGpsLocation(location)
      },
      () => {
        setIsLocating(false)
        setGeolocationDenied(true)
      },
      // Without an explicit timeout, a browser that never resolves (no GPS,
      // location services off at the OS level) hangs forever with neither
      // callback firing — the click just silently does nothing.
      { timeout: 10000 },
    )
  }

  // If the browser already has standing permission (granted on an earlier
  // visit), fetch a fresh location silently — no banner, no click needed —
  // instead of waiting for the cached one to go stale. Falls back to
  // leaving the "Allow location"/cached-location flow alone when
  // permission is 'prompt', 'denied', or unqueryable (Safari). Skipped
  // once gpsLocation is already set (from cache or this same check) — no
  // point silently re-fetching on every render.
  useEffect(() => {
    if (tool?.slug !== 'steps-planner' || gpsLocation) return
    let cancelled = false
    queryGeolocationPermission().then((state) => {
      if (cancelled || state !== 'granted') return
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return
          const location = { lat: position.coords.latitude, lng: position.coords.longitude }
          setGpsLocation(location)
          setCachedGpsLocation(location)
        },
        () => {},
        { timeout: 10000 },
      )
    })
    return () => {
      cancelled = true
    }
  }, [tool?.slug, gpsLocation])

  // A single mutation instance handling however many uploads are in
  // flight at once — each call is independent (its own promise, its own
  // onSuccess with that call's own variables), so concurrent picks don't
  // interfere with each other even though isPending/isError below only
  // reflect the most recently started one.
  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File; localId: string }) => uploadAttachment(file),
    onSuccess: (uploaded, { localId }) => {
      setPendingAttachments((current) =>
        current.map((attachment) => (attachment.localId === localId ? { ...attachment, uploaded } : attachment)),
      )
    },
  })

  function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Same input can be picked again later — without resetting, choosing
    // the exact same file twice in a row wouldn't fire onChange the second
    // time.
    event.target.value = ''
    if (!file || !ALLOWED_UPLOAD_CONTENT_TYPES.includes(file.type)) return
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setFileError(`That file's too big — max ${MAX_UPLOAD_SIZE_MB}MB.`)
      return
    }
    setFileError(null)
    const localId = crypto.randomUUID()
    setPendingAttachments((current) => [
      ...current,
      { localId, previewUrl: URL.createObjectURL(file), filename: file.name, contentType: file.type, uploaded: null },
    ])
    uploadMutation.mutate({ file, localId })
  }

  function handleRemoveAttachment(localId: string) {
    setPendingAttachments((current) => {
      const target = current.find((attachment) => attachment.localId === localId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((attachment) => attachment.localId !== localId)
    })
  }

  function handleRemoveItem(itemId: string) {
    setPendingItems((current) => current.filter((item) => item.id !== itemId))
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
    mutationFn: async ({ content, skipRouter, attachments, itemIds, gpsLocation: sendGpsLocation }: SendVars) => {
      const result = isNewChat
        ? await createChat(tool!.slug, content, skipRouter, attachments, itemIds, sendGpsLocation)
        : await addMessage(chatId!, content, skipRouter, attachments, itemIds, sendGpsLocation)
      // No real API latency yet (see openai.service.ts) — hold the reply so
      // the fake "generating" stages below get a beat on screen instead of
      // flashing in and out instantly.
      await delay(getLoadingDuration(tool!.slug))
      return result
    },
    // Shows the user's own message immediately rather than waiting on the
    // (now artificially delayed) round trip — reverted below if the router
    // redirects instead of actually saving it to this chat.
    onMutate: ({ content, attachments, previewUrls, attachedItems }: SendVars) => {
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
              // A user message never carries Steps Planner's real-route
              // snapshot — only ever set on the assistant's own reply.
              routeDistanceMeters: null,
              routeDurationSeconds: null,
              routeEncodedPolyline: null,
              routeStartLabel: null,
              routeDestinationLabel: null,
              routeThreadId: null,
              // previewUrls (the local blobs, shown instantly) stand in for
              // the real presigned view urls until onSuccess replaces this
              // whole optimistic message with the server's actual response.
              attachments:
                attachments && attachments.length > 0
                  ? attachments.map((attachment, index) => ({ ...attachment, url: previewUrls?.[index] ?? '' }))
                  : null,
              // attachedItems here are the full Items (see SendVars) — same
              // shape as the backend's snapshot (itemId/toolSlug/title/data)
              // once flattened, enough for CompactItemCard to render.
              attachedItems:
                attachedItems && attachedItems.length > 0
                  ? attachedItems.map((item) => ({ itemId: item.id, toolSlug: item.toolSlug, title: item.title, data: item.data }))
                  : null,
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
    sendMutation.mutate({
      content: firstMessage,
      attachments: firstAttachments,
      previewUrls: firstPreviewUrls,
      itemIds: firstItemIds,
      attachedItems: firstAttachedItems,
      gpsLocation: firstGpsLocation,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A photo (or item) with no caption still needs some non-empty content
  // (see AddMessageDto/CreateChatDto's @MinLength(1)) — the attachment
  // itself is the actual message in that case.
  function fallbackContent(attachmentCount: number, items: Item[]): string {
    if (items.length === 1) return `See attached ${items[0].title}.`
    if (items.length > 1) return 'See attached items.'
    return attachmentCount > 1 ? 'See attached images.' : 'See attached image.'
  }

  function handleSend() {
    if (!chatId) return
    if (!draft.trim() && pendingAttachments.length === 0 && pendingItems.length === 0) return
    const uploaded = pendingAttachments.filter((attachment) => attachment.uploaded)
    sendMutation.mutate({
      content: draft.trim() || fallbackContent(uploaded.length, pendingItems),
      attachments: uploaded.length > 0 ? uploaded.map((attachment) => attachment.uploaded!) : undefined,
      previewUrls: uploaded.length > 0 ? uploaded.map((attachment) => attachment.previewUrl) : undefined,
      itemIds: pendingItems.length > 0 ? pendingItems.map((item) => item.id) : undefined,
      attachedItems: pendingItems.length > 0 ? pendingItems : undefined,
      gpsLocation: gpsLocation ?? undefined,
    })
    setDraft('')
    setPendingAttachments([])
    setPendingItems([])
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
              <div className="flex max-w-[80%] flex-col items-end gap-1.5">
                {message.attachments?.map((attachment) =>
                  attachment.contentType.startsWith('image/') ? (
                    <img
                      key={attachment.url}
                      src={attachment.url}
                      alt={attachment.filename}
                      className="max-h-64 rounded-2xl object-cover"
                    />
                  ) : (
                    <FileAttachmentChip key={attachment.url} filename={attachment.filename} />
                  ),
                )}
                {message.attachedItems && message.attachedItems.length > 0 && (
                  <div className="flex w-full gap-2 overflow-x-auto">
                    {message.attachedItems.map((item) => (
                      <div key={item.itemId} className="w-48 flex-shrink-0">
                        <CompactItemCard toolSlug={item.toolSlug} title={item.title} />
                      </div>
                    ))}
                  </div>
                )}
                <p className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-900">{message.content}</p>
              </div>
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
                onCopyTextChange={(text) => handleCopyTextChange(message.id, text)}
                routeDistanceMeters={message.routeDistanceMeters}
                routeDurationSeconds={message.routeDurationSeconds}
                routeEncodedPolyline={message.routeEncodedPolyline}
                routeStartLabel={message.routeStartLabel}
                routeDestinationLabel={message.routeDestinationLabel}
                routeThreadId={message.routeThreadId}
              />
              <MessageActions content={copyTexts[message.id] ?? message.content} saveStatus={saveStatuses[message.id]} />
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

        {tool.slug === 'steps-planner' && !gpsLocation && keyboardInset === 0 && !redirectSuggestion && (
          <ToolNotice
            icon={MapPin}
            message={
              geolocationDenied ? (
                "Couldn't get your location — just name a starting point instead (e.g. \"from Dudley town centre\")."
              ) : isLocating ? (
                'Getting your location…'
              ) : (
                <>
                  Steps Planner needs your location to build a route from where you are.{' '}
                  <button type="button" onClick={handleAllowLocation} className="underline">
                    Allow location
                  </button>
                </>
              )
            }
          />
        )}

        {tool.slug === 'steps-planner' && gpsLocation && keyboardInset === 0 && !redirectSuggestion && (
          <ToolNotice
            icon={MapPin}
            message={
              isLocating ? (
                'Updating your location…'
              ) : (
                <>
                  Using your saved location ({gpsLocation.lat.toFixed(3)}, {gpsLocation.lng.toFixed(3)}).{' '}
                  <button type="button" onClick={handleAllowLocation} className="underline">
                    Update location
                  </button>
                </>
              )
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
            {fileError && <p className="mb-2 text-sm text-red-600">{fileError}</p>}

            {uploadMutation.isError && (
              <p className="mb-2 text-sm text-red-600">Couldn&rsquo;t upload that — try again.</p>
            )}

            {/* One horizontal-scrolling row for every pending attachment —
                photos and items mixed together in pick order. There's no
                multi-select in the attach menu; adding more than one of
                either means reopening it again, so this row is what lets
                several queued attachments stay visible (and individually
                removable) side by side instead of only showing the last
                one picked. */}
            {(pendingAttachments.length > 0 || pendingItems.length > 0) && (
              // pt-2/pr-2: an overflow-x-auto container also clips
              // vertical/trailing overflow (a CSS quirk — setting only one
              // axis to auto forces the other off 'visible' too), which was
              // cropping the remove buttons' negative -top-1.5/-right-1.5
              // offset. This padding gives them room instead.
              <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1 pt-2" onClick={(event) => event.stopPropagation()}>
                {pendingAttachments.map((attachment) => (
                  <div key={attachment.localId} className="relative h-16 flex-shrink-0">
                    {attachment.contentType.startsWith('image/') ? (
                      <img
                        src={attachment.previewUrl}
                        alt=""
                        className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <FileAttachmentChip filename={attachment.filename} compact />
                    )}
                    {!attachment.uploaded && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                        <Loader2 className="h-5 w-5 animate-spin text-white" strokeWidth={1.75} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(attachment.localId)}
                      aria-label="Remove attachment"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
                    >
                      <X className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}

                {pendingItems.map((item) => (
                  <div key={item.id} className="relative w-44 flex-shrink-0">
                    <CompactItemCard toolSlug={item.toolSlug} title={item.title} compact />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label="Remove item"
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white"
                    >
                      <X className="h-3 w-3" strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}

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
              {/* Photos stays image-only (its own input's accept="image/*"
                  below); Files opens a separate input accepting documents
                  too (see ALLOWED_UPLOAD_FILE_EXTENSIONS). Items opens the
                  picker sheet below. */}
              <AttachmentMenu
                triggerClassName="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                iconClassName="h-4 w-4"
                groups={[
                  [
                    { label: 'Camera', icon: Camera, onClick: () => cameraInputRef.current?.click() },
                    { label: 'Photos', icon: ImageIcon, onClick: () => fileInputRef.current?.click() },
                    { label: 'Files', icon: FileIcon, onClick: () => documentInputRef.current?.click() },
                    { label: 'Items', icon: Layers, onClick: () => setIsItemPickerOpen(true) },
                  ],
                ]}
              />
              <button
                type="button"
                disabled={
                  (!draft.trim() && pendingAttachments.length === 0 && pendingItems.length === 0) ||
                  pendingAttachments.some((attachment) => !attachment.uploaded) ||
                  sendMutation.isPending
                }
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

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" />
      <input
        ref={documentInputRef}
        type="file"
        accept={ALLOWED_UPLOAD_FILE_EXTENSIONS}
        onChange={handleFilePicked}
        className="hidden"
      />

      {isItemPickerOpen && (
        <ItemPickerSheet
          onClose={() => setIsItemPickerOpen(false)}
          onSelect={(item) => {
            // Ignore a repeat pick of the same item rather than showing a
            // duplicate chip — no multi-select, but re-picking one already
            // queued isn't a meaningful second attachment.
            setPendingItems((current) => (current.some((existing) => existing.id === item.id) ? current : [...current, item]))
            setIsItemPickerOpen(false)
          }}
        />
      )}
    </main>
  )
}

export default Chat
