import DefaultResponse from '../default/ResponseView'
import { useAmendableItemSave } from '../useAmendableItemSave'
import { PlanRows } from '../planTable'
import type { ResponseViewProps } from '../responseViews'

interface SelfCarePlan {
  // Stable per-plan id assigned by the model (see tool-config.ts) — same
  // mechanism as diet's planKey/cooking's dishKey. Reused across every
  // reply that amends the same plan, only changing when the user asks for
  // a genuinely different one. Combined with chatId for the actual dedup
  // key, so two different plans in one chat don't collapse into a single
  // item.
  planKey: string
  planTitle: string
  columns: string[]
  rows: string[][]
}

// `kind: 'chat'` replies (getting to know the user, checking in on how
// they're feeling, small talk — see tool-config.ts) carry the same
// envelope with the rest null and the reply text in `reply` instead; only
// a 'plan' reply renders as a list or gets auto-saved.
function isSelfCarePlan(value: unknown): value is SelfCarePlan {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return (
    typeof data.planKey === 'string' &&
    typeof data.planTitle === 'string' &&
    Array.isArray(data.columns) &&
    Array.isArray(data.rows)
  )
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function SelfCareResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: SelfCarePlan | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isSelfCarePlan(parsed)) data = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  useAmendableItemSave({
    toolSlug,
    chatId,
    messageId,
    readOnly,
    onSaveStatusChange,
    item: data ? { key: data.planKey, title: data.planTitle, data } : null,
  })

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-slate-900">{data.planTitle}</h2>
      <PlanRows columns={data.columns} rows={data.rows} />
    </div>
  )
}

export default SelfCareResponse
