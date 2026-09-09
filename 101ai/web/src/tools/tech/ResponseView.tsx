import DefaultResponse from '../default/ResponseView'
import { useAmendableItemSave } from '../useAmendableItemSave'
import type { ResponseViewProps } from '../responseViews'

interface TechGuide {
  // Stable per-problem id assigned by the model (see tool-config.ts) — same
  // mechanism as cooking's dishKey/diet's planKey. Reused across every
  // reply about the same problem as it gets refined with what the user
  // tried and what happened, only changing when they bring up a genuinely
  // different, unrelated problem. Combined with chatId for the actual
  // dedup key, so two different problems in one chat don't collapse into a
  // single item.
  problemKey: string
  problemTitle: string
  steps: string[]
}

// `kind: 'chat'` replies (greetings, small talk, or needing more detail
// about the problem first — see tool-config.ts) carry the same envelope
// with the rest null and the reply text in `reply` instead; only a 'guide'
// reply renders as a guide or gets auto-saved.
function isTechGuide(value: unknown): value is TechGuide {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return typeof data.problemKey === 'string' && typeof data.problemTitle === 'string' && Array.isArray(data.steps)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function TechResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: TechGuide | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isTechGuide(parsed)) data = parsed
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
    item: data ? { key: data.problemKey, title: data.problemTitle, data } : null,
  })

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-slate-900">{data.problemTitle}</h2>
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

export default TechResponse
