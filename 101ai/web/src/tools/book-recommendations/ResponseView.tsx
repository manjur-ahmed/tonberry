import { useEffect, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { fetchBookImage, fetchMangaImage, type RecommendationImage } from '../../lib/images'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import { buildCardListCopyText } from '../../lib/copyText'
import type { ResponseViewProps } from '../responseViews'

// Covers books, comics, manga, manhwa, and light novels — not book-only
// (see tool-config.ts's 'book-recommendations' task), hence `Read`/`reads`
// rather than `Book`/`books`, and a generic rating+ratingSource pair
// instead of a fixed Goodreads field (Goodreads isn't the right authority
// for manga/manhwa — MyAnimeList/AniList are; the model names whichever
// site the figure is actually from).
interface Read {
  title: string
  author: string | null
  year: string | null
  format: string | null
  genre: string | null
  summary: string | null
  whyRecommended: string | null
  rating: number | null
  ratingSource: string | null
  // Only present once a saved item is reopened (see ItemDetailModal) — the
  // real cover resolved and saved the first time this entry was searched.
  // Never present on a live turn's own JSON straight from the model.
  image?: RecommendationImage
}

interface ReadRecommendations {
  reads: Read[]
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with `reads` empty and the
// reply text in `reply` instead; only a 'recommendations' reply with at
// least one entry renders as a list or gets auto-saved. `kind` is missing on
// messages saved before this field existed — treat that as a (legacy)
// recommendations reply too, rather than failing the check and dumping raw
// JSON for old chat history.
function isReadRecommendations(value: unknown): value is ReadRecommendations {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return Array.isArray(data.reads) && data.reads.length > 0
}

// A saved item's `data` is a single Read (see saveMutation below — one item
// per entry, not the whole {reads: [...]} reply envelope), so ItemDetailModal
// feeding item.data back through this same ResponseView (the way
// word-helper's item shape already matches its response shape) needs its
// own check rather than isReadRecommendations.
function isSingleRead(value: unknown): value is Read {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && !('reads' in data) && !('kind' in data)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

// AniList's manga database covers manga, manhwa, and light novels together
// (see AniListClient) — anything else (Book, Comic, or unset) goes through
// Google Books instead, which is also the explicit fallback source for
// Western comics.
const ANILIST_FORMATS = new Set(['Manga', 'Manhwa', 'Light Novel'])

function fetchReadImage(read: Read): Promise<RecommendationImage | null> {
  if (read.format && ANILIST_FORMATS.has(read.format)) return fetchMangaImage(read.title)
  return fetchBookImage(read.title, read.author)
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

// Dedup key includes the author, not just the title — unlike a film, two
// different books/manga can share the exact same title.
function dedupKey(read: Read): string {
  return `${read.title}::${read.author ?? ''}`.toLowerCase()
}

function ReadCard({ read, image }: { read: Read; image?: RecommendationImage }) {
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
          {read.title}
          {read.year && <span className="text-slate-400"> ({read.year})</span>}
        </h3>
        {read.author && <p className="mt-0.5 text-sm text-slate-500">{read.author}</p>}
        {(read.format || read.genre) && (
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {[read.format, read.genre].filter(Boolean).join(' · ')}
          </p>
        )}
        {read.summary && <p className="mt-3 text-sm text-slate-700">{read.summary}</p>}
        {read.whyRecommended && (
          <div className="mt-3">
            <Label>Why this one</Label>
            <p className="mt-1 text-sm text-slate-700">{read.whyRecommended}</p>
          </div>
        )}
        {read.rating != null && read.ratingSource && (
          <div className="mt-3 flex items-center gap-1 text-sm text-slate-700">
            <Star className="h-4 w-4 text-amber-400" strokeWidth={1.75} fill="currentColor" />
            <span>{read.rating.toFixed(1)}/5 on {read.ratingSource}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function buildReadCopyText(read: Read): string {
  return [
    read.year ? `${read.title} (${read.year})` : read.title,
    read.author,
    [read.format, read.genre].filter(Boolean).join(' · ') || null,
    read.summary,
    read.whyRecommended ? `Why this one: ${read.whyRecommended}` : null,
    read.rating != null && read.ratingSource ? `${read.rating.toFixed(1)}/5 on ${read.ratingSource}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n')
}

function ReadRecommendationsResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange, onCopyTextChange }: ResponseViewProps) {
  let data: ReadRecommendations | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isReadRecommendations(parsed)) data = parsed
    else if (isSingleRead(parsed)) data = { reads: [parsed] }
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  // One real cover lookup per entry, routed to Google Books or AniList by
  // format (see fetchReadImage). `null` at index i means "no image found"
  // — the array itself being non-null is what means "resolved" (see
  // imagesReady below). A reopened saved item already carries its final
  // image (if any) straight in `read.image`, so it never re-searches.
  const [images, setImages] = useState<(RecommendationImage | null)[] | null>(() => {
    if (!data) return null
    if (readOnly) return data.reads.map((read) => read.image ?? null)
    return null
  })

  useEffect(() => {
    if (!data || readOnly) return
    let cancelled = false
    Promise.all(data.reads.map(fetchReadImage)).then((results) => {
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
      // One item per entry, deduped by title+author — recommending "Dune"
      // again in a later chat updates the same saved item rather than
      // piling up duplicates. Promise.all here means one entry hitting the
      // free-plan item limit surfaces as the overall save failing (onError
      // below), even though any entries saved before the limit was hit stay
      // saved. Carries each entry's resolved image (if any) into the saved
      // data.
      const request = Promise.all(
        data.reads.map((read, index) =>
          saveItem(
            toolSlug,
            chatId,
            read.title,
            { ...read, image: images?.[index] ?? undefined },
            dedupKey(read),
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
  // Waits on imagesReady so the save carries each entry's real resolved
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
    if (data) onCopyTextChange?.(buildCardListCopyText(data.reads.map(buildReadCopyText)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    // pb-2 on top of MessageActions' own mt-2 (see Chat.tsx) puts more gap
    // before the feedback row than sits between cards (space-y-4) — without
    // it, the last entry's content butts right up against the feedback
    // icons and reads as if they belong to that entry specifically rather
    // than to the whole multi-entry response.
    <div className="space-y-4 pb-2">
      {data.reads.map((read, index) => (
        <ReadCard key={dedupKey(read)} read={read} image={images?.[index] ?? undefined} />
      ))}
    </div>
  )
}

export default ReadRecommendationsResponse
