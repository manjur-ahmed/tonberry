import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

// Unlike business-research (one item per *chat*, sections accumulated one
// at a time via ItemsService.upsertSection), this is one item per *plan*,
// saved wholesale via ItemsService.saveItem — same amend-in-place mechanism
// as cooking's dishKey/diet's planKey. Every reply is the COMPLETE current
// plan, not a diff, so the saved item's `data` is always this same shape —
// no separate "live turn" vs. "full saved document" distinction needed the
// way business-research/science-explainer have.
interface BusinessPlan {
  // Stable per-plan id assigned by the model (see tool-config.ts) — same
  // mechanism as cooking's dishKey. Reused across every reply that amends
  // the same plan, only changing when the user asks for a genuinely
  // different business idea. Combined with chatId for the actual dedup
  // key, so two different plans in one chat don't collapse into a single
  // item.
  planKey: string
  planTitle: string
  sections: { heading: string; body: string }[]
}

// `kind: 'chat'` replies (greetings, small talk, a vague idea that needs
// clarifying — see tool-config.ts) carry the same envelope with the rest
// null and the reply text in `reply` instead; only a 'plan' reply renders
// as a document or gets auto-saved.
function isBusinessPlan(value: unknown): value is BusinessPlan {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return (
    typeof data.planKey === 'string' &&
    typeof data.planTitle === 'string' &&
    Array.isArray(data.sections)
  )
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function BusinessPlanResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: BusinessPlan | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isBusinessPlan(parsed)) data = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // Dedup key is chatId + planKey, not the plan title — see cooking's
      // ResponseView for why (a title can change as the plan gets amended,
      // planKey is what stays stable across that).
      const request = saveItem(toolSlug, chatId, data.planTitle, data, `${chatId}:${data.planKey}`)
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

  // Every plan reply is worth saving, so it happens automatically rather
  // than waiting on a user click. Runs once per message instance (component
  // is freshly mounted per message.id) — the ref guard is only to dodge
  // StrictMode's dev-mode double-invoke; the dedup key already makes a
  // genuine double-call harmless either way.
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
      <h2 className="font-display text-2xl font-bold text-slate-900">{data.planTitle}</h2>
      <div className="mt-4 space-y-6">
        {data.sections.map((section, index) => (
          <div key={index}>
            <h3 className="font-display text-lg font-semibold text-slate-900">{section.heading}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BusinessPlanResponse
