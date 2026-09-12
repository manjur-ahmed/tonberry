import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowUp, Copy, Send, Sparkles, Trash2 } from 'lucide-react'
import { getTool, type Tool } from '../tools/registry'
import { generateContent } from '../lib/generate'
import { getItem, saveItem, ItemLimitReachedError } from '../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../lib/delay'
import { hasSeenItemLimitNotice, markItemLimitNoticeSeen } from '../lib/itemLimitNotice'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import OptionsMenu from '../components/OptionsMenu'
import AttachmentMenu from '../components/AttachmentMenu'
import SaveStatusIndicator from '../components/SaveStatusIndicator'
import ItemLimitBanner from '../components/ItemLimitBanner'
import type { SaveStatus } from '../tools/responseViews'

const MAX_TEXTAREA_HEIGHT = 88 // ~4 lines at text-sm, matches Chat.tsx's compose box

function getBodyFromItemData(data: unknown): string {
  if (data && typeof data === 'object' && 'body' in data && typeof (data as { body: unknown }).body === 'string') {
    return (data as { body: string }).body
  }
  return ''
}

// Route-level wrapper: resolves /tools/:slug/notes/:noteId into either a
// blank new note (noteId 'new', the FAB's default) or an existing saved
// Item to fetch and edit. Split out from NoteEditorForm below because the
// form's state (title/body) needs a real initial value on its very first
// render — for an existing note that value only exists once the fetch
// resolves, and hooks can't be called conditionally to wait for that, so
// this wrapper mounts the form fresh (via `key`) only once it has one.
function NoteEditor() {
  const { slug, noteId } = useParams<{ slug: string; noteId: string }>()
  const tool = slug ? getTool(slug) : undefined
  const location = useLocation()
  const isNewNote = !noteId || noteId === 'new'

  const {
    data: existingItem,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['item', noteId],
    queryFn: () => getItem(noteId!),
    enabled: !isNewNote,
  })

  if (!tool) {
    return (
      <main className="px-4 py-6">
        <p className="text-slate-600">Tool not found.</p>
      </main>
    )
  }

  if (!isNewNote && isLoading) {
    return (
      <main className="px-4 py-6">
        <p className="text-slate-600">Loading...</p>
      </main>
    )
  }

  if (!isNewNote && (isError || !existingItem)) {
    return (
      <main className="px-4 py-6">
        <p className="text-slate-600">Note not found.</p>
      </main>
    )
  }

  const state = location.state as { initialBody?: string; initialTitle?: string } | null

  return (
    <NoteEditorForm
      key={noteId}
      tool={tool}
      initialTitle={existingItem?.title ?? state?.initialTitle ?? ''}
      initialBody={existingItem ? getBodyFromItemData(existingItem.data) : (state?.initialBody ?? '')}
      noteKey={existingItem?.dedupKey ?? undefined}
    />
  )
}

interface NoteEditorFormProps {
  tool: Tool
  initialTitle: string
  initialBody: string
  // The existing item's own dedupKey when reopening a saved note, so
  // autosave keeps amending that same Item instead of forking a new one.
  // Undefined for a genuinely new note — a fresh one is generated below.
  noteKey?: string
}

// The actual editor — title/body local state, autosaved as a real Item
// (see lib/items.ts) keyed by a dedupKey so repeat saves amend the same
// item instead of piling up duplicates. The compose bar at the bottom is
// the same one Chat.tsx uses to talk to the AI, reused here so a note can
// keep asking for help without leaving it — each send calls the same
// generate endpoint and appends the reply to the note rather than starting
// a new chat thread.
function NoteEditorForm({ tool, initialTitle, initialBody, noteKey: noteKeyProp }: NoteEditorFormProps) {
  const navigate = useNavigate()
  const keyboardInset = useKeyboardInset()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [draft, setDraft] = useState('')
  const [isComposeFocused, setIsComposeFocused] = useState(false)
  const [noteKey] = useState(() => noteKeyProp ?? crypto.randomUUID())

  const saveMutation = useMutation({
    mutationFn: (vars: { title: string; body: string }) => {
      const request = saveItem(tool.slug, null, vars.title.trim() || 'Untitled note', { body: vars.body }, noteKey)
      // Same reasoning as word-helper's ResponseView — a save that resolves
      // in 20ms still shows its spinner for this long so it reads as a
      // spinner rather than flash past unreadably.
      return withMinDuration(request, MIN_SAVE_SPINNER_MS)
    },
    onError: (error) => {
      if (error instanceof ItemLimitReachedError && !hasSeenItemLimitNotice(noteKey)) {
        markItemLimitNoticeSeen(noteKey)
      }
    },
  })

  const saveStatus: SaveStatus | null = saveMutation.isPending
    ? 'saving'
    : saveMutation.isSuccess
      ? 'saved'
      : saveMutation.isError
        ? saveMutation.error instanceof ItemLimitReachedError
          ? 'limit-reached'
          : 'error'
        : null

  // Serializes saves so they can never overlap in flight. Without this, two
  // saves dispatched close together (e.g. the debounce below firing again
  // right as an AI revision lands) could complete out of order — a slower
  // but earlier-dispatched request landing AFTER a faster later one, its
  // older title/body silently overwriting the newer save. That's exactly
  // what made a note flip back to older content on reopen: not a display
  // bug, the DB itself had been reverted by a stale in-flight write.
  // Anything requested while a save is already running is queued — only the
  // latest queued state is ever actually sent once the current one settles,
  // coalescing intermediate saves rather than firing them all.
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef<{ title: string; body: string } | null>(null)

  function queueSave(vars: { title: string; body: string }) {
    if (isSavingRef.current) {
      pendingSaveRef.current = vars
      return
    }
    isSavingRef.current = true
    saveMutation.mutate(vars, {
      onSettled: () => {
        isSavingRef.current = false
        const next = pendingSaveRef.current
        if (next) {
          pendingSaveRef.current = null
          queueSave(next)
        }
      },
    })
  }

  // Debounced autosave — any title/body change reschedules this instead of
  // firing immediately, so a save only happens once typing's actually
  // paused for a beat, not on every keystroke. Skipped entirely while the
  // note is genuinely empty (nothing worth saving yet), which also means a
  // blank new note doesn't autosave the instant it's opened.
  useEffect(() => {
    if (!title.trim() && !body.trim()) return
    const timeout = setTimeout(() => {
      queueSave({ title, body })
    }, 1000)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [draft])

  const generateMutation = useMutation({
    // Sends the note's current title/body as context (see GenerateDto and
    // tool-config.ts's writer task) — without this the model had no idea
    // what it was editing on a follow-up ask, which is what let something
    // like "put it inside the list" produce a disconnected, unrelated
    // fruit list instead of actually revising the note.
    mutationFn: (prompt: string) => generateContent(tool.slug, prompt, { title, body }),
    // The reply is the note's COMPLETE revised title/content, not a
    // fragment to tack on — replaces both wholesale rather than appending,
    // since the model was given the current state and asked to revise it
    // as a whole (see tool-config.ts).
    onSuccess: (generated) => {
      setTitle(generated.title)
      setBody(generated.content)
      setDraft('')
    },
  })

  function handleSend() {
    if (!draft.trim()) return
    generateMutation.mutate(draft)
  }

  function handleCopyAll() {
    const text = title.trim() ? `${title}\n\n${body}` : body
    navigator.clipboard.writeText(text)
  }

  return (
    <main className="flex flex-1 flex-col px-4 pt-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="text-2xl text-slate-900"
        >
          ←
        </button>

        <div className="flex items-center gap-3">
          {/* 'saved' shows nothing here — no lingering checkmark once a
              save completes, unlike Chat.tsx's usage of this same
              indicator. 'saving' and the error states still show. */}
          {saveStatus && saveStatus !== 'saved' && <SaveStatusIndicator status={saveStatus} />}
          {/* Copy all and the autosave above are real. Send to and Delete
              are still placeholders — Send to has nowhere defined to go
              yet, and Delete discards the draft and leaves rather than
              actually deleting the now-real saved item. */}
          <OptionsMenu
            triggerClassName="text-slate-500"
            iconClassName="h-5 w-5"
            items={[
              { label: 'Copy all', icon: Copy, onClick: handleCopyAll },
              { label: 'Send to', icon: Send, onClick: () => {} },
              { label: 'Delete', icon: Trash2, tone: 'danger', onClick: () => navigate(-1) },
            ]}
          />
        </div>
      </div>

      {saveStatus === 'limit-reached' && <ItemLimitBanner />}

      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Untitled note"
        className="mt-4 font-display text-2xl font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none"
      />

      {/* pb-96 is blank scrollable room, not visual spacing — a textarea's
          own box height doesn't change, but its padding still counts toward
          what's scrollable, so this is what lets the last real line scroll
          all the way clear of the compose bar's fixed footprint below,
          instead of ending exactly where scrolling runs out. */}
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Start writing…"
        className="mt-4 flex-1 resize-none pb-96 text-base leading-relaxed text-slate-700 placeholder:text-slate-400 focus:outline-none"
      />

      {/* Soft scrim behind the compose bar — the note's own text can scroll
          up underneath it (see the body textarea above), so this keeps the
          bar legible against whatever's back there instead of text just
          cutting off hard at its edge. pointer-events-none so it never
          blocks scrolling/typing in what's behind it. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-t from-white via-white/95 to-transparent" />

      {/* fixed, not sticky — see Chat.tsx's identical compose bar for why
          (iOS doesn't shrink the layout viewport for the on-screen
          keyboard, so sticky's offset ends up wrong). bottom-16 rests above
          BottomNav; the inline style takes over once the keyboard is up. */}
      <div
        className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md px-4"
        style={{ bottom: keyboardInset > 0 ? keyboardInset : undefined }}
      >
        {generateMutation.isError && (
          <p className="mb-2 text-center text-sm text-red-600">Couldn&rsquo;t generate that — try again.</p>
        )}
        <div className="flex items-end">
          {/* Always rendered, not conditionally — collapsing width/opacity/
              margin on the same element is what actually animates; swapping
              it in and out of the tree on focus (like before) snapped
              instantly since there's nothing to transition between. */}
          <div
            className={`flex-shrink-0 overflow-hidden transition-all duration-200 ease-in-out ${
              isComposeFocused ? 'mr-0 w-0 opacity-0' : 'mr-2 w-11 opacity-100'
            }`}
          >
            <AttachmentMenu
              triggerTabIndex={isComposeFocused ? -1 : 0}
              triggerClassName="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm"
              iconClassName="h-4 w-4"
            />
          </div>

          {/* rounded-[22px], not rounded-full — 22px is this pill's own
              radius at rest (~44px tall, matching the 44px round buttons
              either side), so a short draft still reads as a full pill, but
              as it grows past that height (see MAX_TEXTAREA_HEIGHT) the same
              fixed radius no longer reaches all the way round, and it eases
              into a plain rounded rectangle instead of staying stadium-
              shaped at every height. */}
          <div
            className="mr-2 flex flex-1 items-center gap-2 rounded-[22px] border border-slate-200 bg-white py-2.5 pl-4 pr-3 shadow-sm transition-[border-radius]"
            onClick={() => textareaRef.current?.focus()}
          >
            <Sparkles className="h-4 w-4 flex-shrink-0 text-violet-500" strokeWidth={1.75} />
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setIsComposeFocused(true)}
              onBlur={() => setIsComposeFocused(false)}
              placeholder="How can I help?"
              rows={1}
              className="w-full resize-none overflow-y-auto bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={!draft.trim() || generateMutation.isPending}
            onClick={handleSend}
            aria-label="Send"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm"
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </main>
  )
}

export default NoteEditor
