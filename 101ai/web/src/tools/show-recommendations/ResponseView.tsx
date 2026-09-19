import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { fetchShowImage, type RecommendationImage } from '../../lib/images'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import { buildCardListCopyText } from '../../lib/copyText'
import type { ResponseViewProps } from '../responseViews'

interface Show {
  title: string
  year: string | null
  genre: string | null
  summary: string | null
  whyRecommended: string | null
  imdbRating: number | null
  // Only present once a saved item is reopened (see ItemDetailModal) — the
  // real poster resolved and saved the first time this show was searched.
  // Never present on a live turn's own JSON straight from the model.
  image?: RecommendationImage
}

interface ShowRecommendations {
  shows: Show[]
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with `shows` empty and the
// reply text in `reply` instead; only a 'recommendations' reply with at
// least one show renders as a list or gets auto-saved. `kind` is missing on
// messages saved before this field existed — treat that as a (legacy)
// recommendations reply too, rather than failing the check and dumping raw
// JSON for old chat history.
function isShowRecommendations(value: unknown): value is ShowRecommendations {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return Array.isArray(data.shows) && data.shows.length > 0
}

// A saved item's `data` is a single Show (see saveMutation below — one item
// per show, not the whole {shows: [...]} reply envelope), so ItemDetailModal
// feeding item.data back through this same ResponseView (the way
// word-helper's item shape already matches its response shape) needs its
// own check rather than isShowRecommendations.
function isSingleShow(value: unknown): value is Show {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && !('shows' in data) && !('kind' in data)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

function ShowCard({ show, image }: { show: Show; image?: RecommendationImage }) {
  return (
    <div className="flex gap-3 bg-white pt-4">
      {image && (
        <div className="w-20 flex-shrink-0">
          <img src={image.url} alt="" className="aspect-[2/3] w-full rounded-lg object-cover" />
          <p className="mt-1 text-center text-[10px] text-slate-400">Image: {image.source}</p>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-xl font-bold text-slate-900">
          {show.title}
          {show.year && <span className="text-slate-400"> ({show.year})</span>}
        </h3>
        {show.genre && <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{show.genre}</p>}
        {show.summary && <p className="mt-3 text-sm text-slate-700">{show.summary}</p>}
        {show.whyRecommended && (
          <div className="mt-3">
            <Label>Why this one</Label>
            <p className="mt-1 text-sm text-slate-700">{show.whyRecommended}</p>
          </div>
        )}
        {show.imdbRating != null && (
          <div className="mt-3 flex items-center gap-1 text-sm text-slate-700">
            <Star className="h-4 w-4 text-amber-400" strokeWidth={1.75} fill="currentColor" />
            <span>{show.imdbRating.toFixed(1)}/10 on IMDb</span>
          </div>
        )}
      </div>
    </div>
  )
}

function buildShowCopyText(show: Show): string {
  return [
    show.year ? `${show.title} (${show.year})` : show.title,
    show.genre,
    show.summary,
    show.whyRecommended ? `Why this one: ${show.whyRecommended}` : null,
    show.imdbRating != null ? `${show.imdbRating.toFixed(1)}/10 on IMDb` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n')
}

function ShowRecommendationsResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange, onCopyTextChange }: ResponseViewProps) {
  let data: ShowRecommendations | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isShowRecommendations(parsed)) data = parsed
    else if (isSingleShow(parsed)) data = { shows: [parsed] }
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  // One real poster lookup per show. `null` at index i means "no image
  // found" — the array itself being non-null is what means "resolved" (see
  // imagesReady below). A reopened saved item already carries its final
  // image (if any) straight in `show.image`, so it never re-searches.
  const [images, setImages] = useState<(RecommendationImage | null)[] | null>(() => {
    if (!data) return null
    if (readOnly) return data.shows.map((show) => show.image ?? null)
    return null
  })

  useEffect(() => {
    if (!data || readOnly) return
    let cancelled = false
    Promise.all(data.shows.map((show) => fetchShowImage(show.title, show.year))).then((results) => {
      if (!cancelled) setImages(results)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imagesReady = !data || readOnly || images !== null

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // One item per show, deduped by title — recommending "Fargo" again in
      // a later chat updates the same saved item rather than piling up
      // duplicates. Promise.all here means one show hitting the free-plan
      // item limit surfaces as the overall save failing (onError below),
      // even though any shows saved before the limit was hit stay saved.
      // Carries each show's resolved image (if any) into the saved data.
      const request = Promise.all(
        data.shows.map((show, index) =>
          saveItem(
            toolSlug,
            chatId,
            show.title,
            { ...show, image: images?.[index] ?? undefined },
            show.title.toLowerCase(),
          ),
        ),
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

  // Every recommendations reply is worth saving, so it happens
  // automatically rather than waiting on a user click. Runs once per
  // message instance (component is freshly mounted per message.id) — the
  // ref guard is only to dodge StrictMode's dev-mode double-invoke; the
  // dedup key already makes a genuine double-call harmless either way.
  // Waits on imagesReady so the save carries each show's real resolved
  // image rather than racing the search.
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
    if (!imagesReady) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesReady])

  // Reports the plain-text version up to Chat.tsx so its copy button copies
  // the recommendations, not this message's raw JSON (see
  // ResponseViewProps.onCopyTextChange).
  useEffect(() => {
    if (data) onCopyTextChange?.(buildCardListCopyText(data.shows.map(buildShowCopyText)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    // pb-2 on top of MessageActions' own mt-2 (see Chat.tsx) puts more gap
    // before the feedback row than sits between cards (space-y-4) — without
    // it, the last show's content butts right up against the feedback
    // icons and reads as if they belong to that show specifically rather
    // than to the whole multi-show response.
    <div className="space-y-4 pb-2">
      {data.shows.map((show, index) => (
        <ShowCard key={show.title} show={show} image={images?.[index] ?? undefined} />
      ))}
    </div>
  )
}

export default ShowRecommendationsResponse
