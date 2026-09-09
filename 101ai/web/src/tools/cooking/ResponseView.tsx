import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
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

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // Dedup key is chatId + dishKey, not the recipe name — a recipe gets
      // amended in place as the conversation goes (add mushrooms, swap an
      // ingredient, rename accordingly), so keying on the name would create
      // a new item every time an amendment renames it. dishKey is what
      // stays stable across those renames; chatId on top of it is what
      // keeps a *different* chat's unrelated "chicken-pie" dishKey from
      // colliding with this one.
      const request = saveItem(toolSlug, chatId, data.recipeName, data, `${chatId}:${data.dishKey}`)
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

  // Every recipe reply is worth saving, so it happens automatically rather
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
