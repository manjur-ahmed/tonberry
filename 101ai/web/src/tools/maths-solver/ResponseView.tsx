import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface MathsSolution {
  // Stable per-problem id assigned by the model (see tool-config.ts) — same
  // mechanism as tech/home/car/diy's guideKey. Reused across every reply
  // still about this same problem (a follow-up, a correction, "explain
  // step 3 more"), only changing when they move on to a genuinely
  // different problem. Combined with chatId for the actual dedup key, so
  // two different problems in one chat don't collapse into a single item.
  problemKey: string
  problemTitle: string
  steps: string[]
  answer: string
}

// `kind: 'chat'` replies (greetings, small talk, or no real problem given
// yet — see tool-config.ts) carry the same envelope with the rest null and
// the reply text in `reply` instead; only a 'solution' reply renders as a
// solution or gets auto-saved.
function isMathsSolution(value: unknown): value is MathsSolution {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return (
    typeof data.problemKey === 'string' &&
    typeof data.problemTitle === 'string' &&
    Array.isArray(data.steps) &&
    typeof data.answer === 'string'
  )
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function MathsSolverResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: MathsSolution | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isMathsSolution(parsed)) data = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // Dedup key is chatId + problemKey, not the problem title — same
      // reasoning as tech's guideKey (a title can change as the solution
      // gets refined, problemKey is what stays stable across that).
      const request = saveItem(toolSlug, chatId, data.problemTitle, data, `${chatId}:${data.problemKey}`)
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

  // Every solution reply is worth saving, so it happens automatically
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
      <h2 className="font-display text-2xl font-bold text-slate-900">{data.problemTitle}</h2>
      <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Answer</p>
        <p className="mt-0.5 font-display text-lg font-bold text-emerald-900">{data.answer}</p>
      </div>
      <ol className="mt-4 space-y-2">
        {data.steps.map((step, index) => (
          <li key={index} className="flex gap-2 text-sm text-slate-700">
            <span className="flex-shrink-0 font-semibold text-slate-400">{index + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default MathsSolverResponse
