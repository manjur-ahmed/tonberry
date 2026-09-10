import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface AdListing {
  // Stable per-listing id assigned by the model (see tool-config.ts) — same
  // mechanism as cooking's dishKey. Reused across every reply that amends
  // the same listing, only changing when the user asks about a genuinely
  // different item. Combined with chatId for the actual dedup key, so two
  // different listings in one chat don't collapse into a single item.
  listingKey: string
  platform: string | null
  itemTitle: string
  description: string | null
  suggestedPrice: string | null
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with the rest null and the
// reply text in `reply` instead; only a 'listing' reply renders as a
// listing or gets auto-saved.
function isAdListing(value: unknown): value is AdListing {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return typeof data.listingKey === 'string' && typeof data.itemTitle === 'string'
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

// The whole point of this tool is a block of text the user can paste
// straight into their listing — assembled here (not trusted to the model
// as one pre-formatted field) so it's always consistent: title, then the
// description, then price only if there is one.
function buildCopyText(listing: AdListing): string {
  return [listing.itemTitle, listing.description, listing.suggestedPrice ? `Price: ${listing.suggestedPrice}` : null]
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

function AdCreatorResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange, onCopyTextChange }: ResponseViewProps) {
  let data: AdListing | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isAdListing(parsed)) data = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // Dedup key is chatId + listingKey, not the item title — see cooking's
      // ResponseView for why (a title can change as the listing gets
      // amended, listingKey is what stays stable across that).
      const request = saveItem(toolSlug, chatId, data.itemTitle, data, `${chatId}:${data.listingKey}`)
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

  // Every listing reply is worth saving, so it happens automatically rather
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

  // Reports the plain-text version up to Chat.tsx so its copy button copies
  // something actually pasteable into a listing, not this message's raw
  // JSON (see ResponseViewProps.onCopyTextChange). Only set for an actual
  // listing — a "chat" reply (a clarifying question) has nothing worth
  // overriding the default copy behaviour for.
  useEffect(() => {
    if (data) onCopyTextChange?.(buildCopyText(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-slate-900">{data.itemTitle}</h2>
      {data.platform && <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{data.platform}</p>}
      {data.description && <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{data.description}</p>}
      {data.suggestedPrice && (
        <div className="mt-3">
          <Label>Suggested price</Label>
          <p className="mt-1 text-sm text-slate-700">{data.suggestedPrice}</p>
        </div>
      )}
    </div>
  )
}

export default AdCreatorResponse
