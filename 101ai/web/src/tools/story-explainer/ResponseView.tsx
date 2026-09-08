import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface StoryExplanation {
  title: string
  // Optional/absent on a message saved before this field existed —
  // isStoryExplanation below doesn't require it, so read it defensively.
  year?: string | null
  explanation: string
}

// "The Batman (2022)" when a year is known, otherwise just the title — for
// on-screen display only. The *saved* item's title (below) stays the plain
// title; year is a separate datapoint combined at display time by this
// tool's own ItemView, the same way film-recommendations does, rather than
// baked into the title itself.
function displayTitle(data: StoryExplanation): string {
  return data.year ? `${data.title} (${data.year})` : data.title
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with title/explanation null
// and the reply text in `reply` instead; only an 'explanation' reply
// renders as an explanation or gets auto-saved. `kind` is missing on
// messages saved before this field existed — treat that as a (legacy)
// explanation too, rather than failing the check and dumping raw JSON for
// old chat history.
function isStoryExplanation(value: unknown): value is StoryExplanation {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return typeof data.title === 'string' && typeof data.explanation === 'string'
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function StoryExplainerResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: StoryExplanation | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isStoryExplanation(parsed)) data = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // title (not displayTitle) — Item.title stays the plain story title;
      // the year lives in `data` and gets combined in for display by this
      // tool's ItemView, same as every other field. Dedup key is that same
      // plain title — asking about "Inception" again (or a follow-up
      // question about it) updates the same item instead of piling up
      // duplicates.
      const request = saveItem(toolSlug, chatId, data.title, data, data.title.toLowerCase())
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

  // Every explanation reply is worth saving, so it happens automatically
  // rather than waiting on a user click. Runs once per message instance
  // (component is freshly mounted per message.id) — the ref guard is only
  // to dodge StrictMode's dev-mode double-invoke; the dedup key already
  // makes a genuine double-call harmless either way.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose item already saved successfully skips straight to
  // "saved" instead of re-running the save (and, if the item limit's since
  // been hit, flashing an error on something that's already safely stored).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (!data || readOnly) return
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
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-slate-900">{displayTitle(data)}</h2>
      <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{data.explanation}</p>
    </div>
  )
}

export default StoryExplainerResponse
