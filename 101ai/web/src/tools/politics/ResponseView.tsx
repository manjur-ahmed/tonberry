import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { upsertItemSection, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import { renderInline } from './renderInline'
import type { ResponseViewProps } from '../responseViews'

// Saves one item per *chat* rather than one per reply (see
// ItemsService.upsertSection), so a rabbit-hole conversation covering
// several angles on one broad subject reads back as one document with
// subheadings, not a pile of items each overwriting the last.

// A single turn's reply — what tool-config.ts's POLITICS_SCHEMA produces
// for one message.
interface TopicTurn {
  topicTitle: string
  sectionHeading: string
  sectionBody: string
  sectionAction: 'new' | 'continue'
}

// The full saved item — {title, sections} — fed back through this same
// component by ItemDetailModal when redisplaying an already-saved item, as
// opposed to one live turn. Structurally distinguishable from TopicTurn: has
// `sections`, never has `kind`.
interface TopicDocument {
  title: string
  sections: { heading: string; body: string }[]
}

function isTopicDocument(value: unknown): value is TopicDocument {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && Array.isArray(data.sections)
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with the rest null and the
// reply text in `reply` instead; only an 'explanation' reply renders as a
// turn or gets auto-saved. `kind` is missing on messages saved before this
// field existed — treat that as a (legacy) turn too, rather than failing
// the check and dumping raw JSON for old chat history.
function isTopicTurn(value: unknown): value is TopicTurn {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return (
    typeof data.topicTitle === 'string' &&
    typeof data.sectionHeading === 'string' &&
    typeof data.sectionBody === 'string' &&
    (data.sectionAction === 'new' || data.sectionAction === 'continue')
  )
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function PoliticsResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let document: TopicDocument | null = null
  let turn: TopicTurn | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isTopicDocument(parsed)) document = parsed
    else if (isTopicTurn(parsed)) turn = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    // Neither shape — falls through to the raw-content DefaultResponse below.
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!turn) throw new Error('Nothing to save')
      const request = upsertItemSection(toolSlug, chatId, {
        topicTitle: turn.topicTitle,
        sectionHeading: turn.sectionHeading,
        sectionBody: turn.sectionBody,
        sectionAction: turn.sectionAction,
      })
      // This resolves near-instantly today, but the spinner should still
      // read as a spinner rather than flash by — holds it open at least
      // this long regardless of how fast (or slow, once real) the save is.
      return withMinDuration(request, MIN_SAVE_SPINNER_MS)
    },
    onMutate: () => onSaveStatusChange?.('saving'),
    onSuccess: () => {
      markItemSavedForMessage(messageId)
      onSaveStatusChange?.('saved')
    },
    onError: (error) => {
      onSaveStatusChange?.(error instanceof ItemLimitReachedError ? 'limit-reached' : 'error')
    },
  })

  // Every explanation turn is worth saving, so it happens automatically
  // rather than waiting on a user click. Runs once per message instance
  // (component is freshly mounted per message.id) — the ref guard is only
  // to dodge StrictMode's dev-mode double-invoke; upsertSection is a
  // read-then-write per call, not a hard dedup key, so a genuine double-call
  // here would double up the section — the ref guard is what actually
  // prevents that, not just StrictMode noise.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose section already saved successfully skips straight to
  // "saved" instead of re-running the save (and, if the item limit's since
  // been hit, flashing an error on something that's already safely stored).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (!turn || readOnly) return
    if (hasSavedItemForMessage(messageId)) {
      onSaveStatusChange?.('saved')
      return
    }
    if (hasSavedRef.current) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  // The full saved document (see ItemDetailModal) — every subheading
  // covered in this chat so far, not just this one turn.
  if (document) {
    return (
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900">{document.title}</h2>
        <div className="mt-4 space-y-6">
          {document.sections.map((section, index) => (
            <div key={index}>
              <h3 className="font-display text-lg font-semibold text-slate-900">{section.heading}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{renderInline(section.body)}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!turn) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-slate-900">{turn.sectionHeading}</h2>
      <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{renderInline(turn.sectionBody)}</p>
    </div>
  )
}

export default PoliticsResponse
