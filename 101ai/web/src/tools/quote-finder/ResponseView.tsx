import { useEffect, useRef } from 'react'
import { ExternalLink } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import { buildYoutubeSearchUrl } from './youtubeSearchUrl'
import type { ResponseViewProps } from '../responseViews'

export interface Quote {
  text: string
  speaker: string | null
  source: string
  sourceType: string
  year: string | null
}

interface QuoteFinderResult {
  quotes: Quote[]
}

// `kind: 'chat'` replies (greetings, small talk, or — importantly for this
// tool — a quote the model isn't confident enough about to state as fact,
// see tool-config.ts) carry the same envelope with `quotes` empty and the
// reply text in `reply` instead; only a 'quotes' reply with at least one
// quote renders as a list or gets auto-saved. `kind` is missing on messages
// saved before this field existed — treat that as a (legacy) quotes reply
// too, rather than failing the check and dumping raw JSON for old history.
function isQuoteFinderResult(value: unknown): value is QuoteFinderResult {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return Array.isArray(data.quotes) && data.quotes.length > 0
}

// A saved item's `data` is a single Quote (see saveMutation below — one
// item per quote, not the whole {quotes: [...]} reply envelope), so
// ItemDetailModal feeding item.data back through this same ResponseView
// needs its own check rather than isQuoteFinderResult.
function isSingleQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.text === 'string' && !('quotes' in data) && !('kind' in data)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

// showVerifyLink defaults true for the chat response, where proving the
// quote is the point — the dashboard item card (see ItemView) passes false,
// it's just a compact record of a quote already seen and verified in chat.
export function QuoteCard({ quote, showVerifyLink = true }: { quote: Quote; showVerifyLink?: boolean }) {
  return (
    <div className="bg-white pt-4">
      <p className="font-display text-lg font-semibold italic leading-snug text-slate-900">&ldquo;{quote.text}&rdquo;</p>
      <p className="mt-2 text-sm text-slate-600">
        {quote.speaker && <span className="font-medium text-slate-900">{quote.speaker}</span>}
        {quote.speaker && ' — '}
        {quote.source}
        {quote.year && <span className="text-slate-400"> ({quote.year})</span>}
      </p>
      {showVerifyLink && (
        <a
          href={buildYoutubeSearchUrl(quote)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
          Search YouTube to verify
        </a>
      )}
    </div>
  )
}

function QuoteFinderResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: QuoteFinderResult | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isQuoteFinderResult(parsed)) data = parsed
    else if (isSingleQuote(parsed)) data = { quotes: [parsed] }
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // One item per quote, deduped by its exact text — asking for the same
      // quote again updates the same saved item rather than piling up
      // duplicates. Promise.all here means one quote hitting the free-plan
      // item limit surfaces as the overall save failing (onError below),
      // even though any quotes saved before the limit was hit stay saved.
      const request = Promise.all(
        data.quotes.map((quote) => saveItem(toolSlug, chatId, quote.text, quote, quote.text.toLowerCase())),
      )
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

  // Every quotes reply is worth saving, so it happens automatically rather
  // than waiting on a user click. Runs once per message instance (component
  // is freshly mounted per message.id) — the ref guard is only to dodge
  // StrictMode's dev-mode double-invoke; the dedup key already makes a
  // genuine double-call harmless either way.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose items already saved successfully skips straight to
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
    // pb-2 on top of MessageActions' own mt-2 (see Chat.tsx) puts more gap
    // before the feedback row than sits between cards (space-y-4) — without
    // it, the last quote's content butts right up against the feedback
    // icons and reads as if it belongs to that quote specifically rather
    // than to the whole multi-quote response.
    <div className="space-y-4 pb-2">
      {data.quotes.map((quote) => (
        <QuoteCard key={quote.text} quote={quote} />
      ))}
    </div>
  )
}

export default QuoteFinderResponse
