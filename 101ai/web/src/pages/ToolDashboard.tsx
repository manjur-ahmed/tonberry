import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUp,
  Camera,
  ChevronRight,
  ChevronUp,
  File as FileIcon,
  Image as ImageIcon,
  Layers,
  Loader2,
  MapPin,
  Minimize2,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { getTool, type ComposeOption } from '../tools/registry'
import { isToolSaved, toggleSavedTool } from '../lib/savedTools'
import { getChatsForTool, type GpsLocation } from '../lib/chats'
import {
  getCachedGpsLocation,
  queryGeolocationPermission,
  setCachedGpsLocation,
} from '../lib/stepsPlannerLocation'
import { deleteItem, getItemsForTool, type Item } from '../lib/items'
import { generateContent } from '../lib/generate'
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  ALLOWED_UPLOAD_FILE_EXTENSIONS,
  MAX_UPLOAD_SIZE_BYTES,
  uploadAttachment,
  type UploadedAttachment,
} from '../lib/uploads'
import { getItemView } from '../tools/itemViews'
import ItemDetailModal from '../components/ItemDetailModal'
import ItemPickerSheet from '../components/ItemPickerSheet'
import CompactItemCard from '../components/CompactItemCard'
import FileAttachmentChip from '../components/FileAttachmentChip'
import OptionsMenu from '../components/OptionsMenu'
import AttachmentMenu from '../components/AttachmentMenu'
import Skeleton from '../components/Skeleton'
import ToolNotice from '../components/ToolNotice'
import { useAuth } from '../hooks/useAuth'
import { useKeyboardInset } from '../hooks/useKeyboardInset'

const tabs = ['Items', 'Chats', 'Examples'] as const
type Tab = (typeof tabs)[number]
const MAX_UPLOAD_SIZE_MB = MAX_UPLOAD_SIZE_BYTES / 1024 / 1024

// One local id per pending upload — see Chat.tsx's identical type for why
// (lets several files queue and upload independently, no multi-select).
// filename/contentType are captured at pick time so the pending chip knows
// whether to show an image thumbnail or a file icon before the upload
// itself has even finished.
interface PendingAttachment {
  localId: string
  previewUrl: string
  filename: string
  contentType: string
  uploaded: UploadedAttachment | null
}

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
  'maths-solver',
  'politics',
  'home',
  'car',
  'diy',
  'general-health',
  'gym-planner',
  'business-plan',
  'business-research',
  // A route's static map thumbnail wants real portrait room (see
  // steps-planner/ItemView.tsx) — cramped into half a 2-column row it'd be
  // tiny and squashed.
  'steps-planner',
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
  // Saved items picked via the attach menu, waiting to go out with the
  // next message — see Chat.tsx's identical pendingItems for why these are
  // full Items, not just ids. No multi-select in the picker; more than one
  // means reopening the menu again, same as pendingAttachments below.
  const [pendingItems, setPendingItems] = useState<Item[]>([])
  // Only relevant for a real chat tool — a hideChatsTab tool's compose
  // sheet only ever calls generateMutation (see handleSend), and /generate
  // doesn't accept attachments (see lib/generate.ts).
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  // A rejected pick (too big) — separate from uploadMutation's own error
  // state, since this never gets far enough to actually attempt an upload.
  const [fileError, setFileError] = useState<string | null>(null)
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false)
  // Steps Planner only — see Chat.tsx's identical trio for why. Seeded
  // from the cached location (if still fresh) so returning within the TTL
  // skips both the browser prompt and the "Allow location" banner.
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(() => getCachedGpsLocation())
  const [geolocationDenied, setGeolocationDenied] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
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

  // A single mutation instance handling however many uploads are in
  // flight at once — see Chat.tsx's identical uploadMutation for why this
  // is safe despite isPending/isError only reflecting the latest call.
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

  // Steps Planner only — see Chat.tsx's identical handler for why.
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
  // permission is 'prompt', 'denied', or unqueryable (Safari).
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

  // A photo (or item) with no caption still needs some non-empty content
  // (see AddMessageDto/CreateChatDto's @MinLength(1)) — the attachment
  // itself is the actual message in that case.
  function fallbackContent(attachmentCount: number, items: Item[]): string {
    if (items.length === 1) return `See attached ${items[0].title}.`
    if (items.length > 1) return 'See attached items.'
    return attachmentCount > 1 ? 'See attached images.' : 'See attached image.'
  }

  function handleSend() {
    if (!tool) return
    if (tool.hideChatsTab) {
      // No chat thread for this tool — the compose sheet only ever opens
      // via the "Generate with AI" option (see handleComposeOption), so
      // sending here always means "generate note content", never a chat.
      // No attachment UI is shown in this branch (see the compose sheet
      // below) since /generate doesn't accept one.
      if (!message.trim()) return
      generateMutation.mutate(message)
      return
    }
    if (!message.trim() && pendingAttachments.length === 0 && pendingItems.length === 0) return
    const uploaded = pendingAttachments.filter((attachment) => attachment.uploaded)
    // The chat doesn't exist yet — Chat.tsx creates it (and shows the
    // normal generating-reply UI) as soon as it lands on "new" with this
    // message, rather than this page waiting on it itself.
    navigate(`/tools/${tool.slug}/chats/new`, {
      state: {
        // A photo (or item) with no caption still needs some non-empty
        // content (see AddMessageDto/CreateChatDto's @MinLength(1)).
        firstMessage: message.trim() || fallbackContent(uploaded.length, pendingItems),
        firstAttachments: uploaded.length > 0 ? uploaded.map((attachment) => attachment.uploaded!) : undefined,
        // Same blob urls Chat.tsx's own optimistic bubble uses — client-side
        // navigation keeps them valid (no full page reload happens), so the
        // first message can show real thumbnails immediately instead of a
        // broken image until the server's presigned urls land.
        firstPreviewUrls: uploaded.length > 0 ? uploaded.map((attachment) => attachment.previewUrl) : undefined,
        firstItemIds: pendingItems.length > 0 ? pendingItems.map((item) => item.id) : undefined,
        firstAttachedItems: pendingItems.length > 0 ? pendingItems : undefined,
        firstGpsLocation: gpsLocation ?? undefined,
      },
    })
    setPendingAttachments([])
    setPendingItems([])
  }

  return (
    // pb-40 — the compose FAB is fixed (bottom-20 + its own ~56px height),
    // so it doesn't reserve space in flow; without this, the last row of
    // the Items grid ends up sitting underneath it instead of above it.
    <main className="px-4 pb-40 pt-6">
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

          {tool?.slug === 'steps-planner' && !gpsLocation && (
            <div className="px-4">
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
            </div>
          )}

          {tool?.slug === 'steps-planner' && gpsLocation && (
            <div className="px-4">
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
            </div>
          )}

          {generateMutation.isError && (
            <p className="px-4 text-sm text-red-600">Couldn&rsquo;t generate that — try again.</p>
          )}

          {fileError && <p className="px-4 text-sm text-red-600">{fileError}</p>}

          {uploadMutation.isError && (
            <p className="px-4 text-sm text-red-600">Couldn&rsquo;t upload that — try again.</p>
          )}

          {/* One horizontal-scrolling row for every pending attachment —
              see Chat.tsx's identical row for why (no multi-select, so
              several queued photos/items stay visible side by side).
              pt-2/pb-1: an overflow-x-auto container also clips vertical
              overflow (setting only one axis to auto forces the other off
              'visible' too), which was cropping the remove buttons' own
              negative -top-1.5/-right-1.5 offset. */}
          {(pendingAttachments.length > 0 || pendingItems.length > 0) && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-2">
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

          <div className="flex items-center justify-between border-slate-100 px-4 py-3">
            {/* No attach affordance for a hideChatsTab tool's compose sheet
                — it only ever calls generateMutation (see handleSend), and
                /generate doesn't accept attachments yet. An empty spacer
                keeps the send button's position consistent either way. */}
            {tool?.hideChatsTab ? (
              <div className="h-10 w-10" />
            ) : (
              <AttachmentMenu
                triggerClassName="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                iconClassName="h-5 w-5"
                groups={[
                  [
                    { label: 'Camera', icon: Camera, onClick: () => cameraInputRef.current?.click() },
                    { label: 'Photos', icon: ImageIcon, onClick: () => fileInputRef.current?.click() },
                    { label: 'Files', icon: FileIcon, onClick: () => documentInputRef.current?.click() },
                    { label: 'Items', icon: Layers, onClick: () => setIsItemPickerOpen(true) },
                  ],
                ]}
              />
            )}

            <button
              type="button"
              disabled={
                (!message.trim() && pendingAttachments.length === 0 && pendingItems.length === 0) ||
                pendingAttachments.some((attachment) => !attachment.uploaded) ||
                generateMutation.isPending
              }
              onClick={handleSend}
              aria-label="Send"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" strokeWidth={2} />
            </button>
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
        </div>
      )}

      {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {isItemPickerOpen && (
        <ItemPickerSheet
          onClose={() => setIsItemPickerOpen(false)}
          onSelect={(item) => {
            // Ignore a repeat pick of the same item — see Chat.tsx's
            // identical guard for why.
            setPendingItems((current) => (current.some((existing) => existing.id === item.id) ? current : [...current, item]))
            setIsItemPickerOpen(false)
          }}
        />
      )}
    </main>
  )
}

export default ToolDashboard
