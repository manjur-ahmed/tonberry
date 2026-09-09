import DefaultResponse from '../default/ResponseView'
import { useAmendableItemSave } from '../useAmendableItemSave'
import type { ResponseViewProps } from '../responseViews'

interface Recipe {
  // Stable per-dish id assigned by the model (see tool-config.ts) — reused
  // across every reply that amends the same dish, only changing when the
  // user switches to a genuinely different one. Combined with chatId below
  // for the actual dedup key, so two different dishes in one chat don't
  // collapse into a single item, and the same dishKey in a *different*
  // chat doesn't collide with this one.
  dishKey: string
  recipeName: string
  ingredients: string[]
  instructions: string[]
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with the rest null and the
// reply text in `reply` instead; only a 'recipe' reply renders as a recipe
// or gets auto-saved. `kind` is missing on messages saved before this field
// existed — treat that as a (legacy) recipe too, rather than failing the
// check and dumping raw JSON for old chat history.
function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return (
    typeof data.dishKey === 'string' &&
    typeof data.recipeName === 'string' &&
    Array.isArray(data.ingredients) &&
    Array.isArray(data.instructions)
  )
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

function CookingResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: Recipe | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isRecipe(parsed)) data = parsed
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
    item: data ? { key: data.dishKey, title: data.recipeName, data } : null,
  })

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-slate-900">{data.recipeName}</h2>

      <div className="mt-4">
        <Label>Ingredients</Label>
        <ul className="mt-2 space-y-1.5">
          {data.ingredients.map((ingredient) => (
            <li key={ingredient} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-300" />
              {ingredient}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <Label>Instructions</Label>
        <ol className="mt-2 space-y-2">
          {data.instructions.map((step, index) => (
            <li key={index} className="flex gap-2 text-sm text-slate-700">
              <span className="flex-shrink-0 font-semibold text-slate-400">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default CookingResponse
