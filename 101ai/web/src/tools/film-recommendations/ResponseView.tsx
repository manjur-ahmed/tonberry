import { useEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface Film {
  title: string
  year: string | null
  genre: string | null
  summary: string | null
  whyRecommended: string | null
  imdbRating: number | null
}

interface FilmRecommendations {
  films: Film[]
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with `films` empty and the
// reply text in `reply` instead; only a 'recommendations' reply with at
// least one film renders as a list or gets auto-saved. `kind` is missing on
// messages saved before this field existed — treat that as a (legacy)
// recommendations reply too, rather than failing the check and dumping raw
// JSON for old chat history.
function isFilmRecommendations(value: unknown): value is FilmRecommendations {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return Array.isArray(data.films) && data.films.length > 0
}

// A saved item's `data` is a single Film (see saveMutation below — one item
// per film, not the whole {films: [...]} reply envelope), so ItemDetailModal
// feeding item.data back through this same ResponseView (the way
// word-helper's item shape already matches its response shape) needs its
// own check rather than isFilmRecommendations.
function isSingleFilm(value: unknown): value is Film {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && !('films' in data) && !('kind' in data)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

function FilmCard({ film }: { film: Film }) {
  return (
    <div className="bg-white pt-4">
      <h3 className="font-display text-xl font-bold text-slate-900">
        {film.title}
        {film.year && <span className="text-slate-400"> ({film.year})</span>}
      </h3>
      {film.genre && <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{film.genre}</p>}
      {film.summary && <p className="mt-3 text-sm text-slate-700">{film.summary}</p>}
      {film.whyRecommended && (
        <div className="mt-3">
          <Label>Why this one</Label>
          <p className="mt-1 text-sm text-slate-700">{film.whyRecommended}</p>
        </div>
      )}
      {film.imdbRating != null && (
        <div className="mt-3 flex items-center gap-1 text-sm text-slate-700">
          <Star className="h-4 w-4 text-amber-400" strokeWidth={1.75} fill="currentColor" />
          <span>{film.imdbRating.toFixed(1)}/10 on IMDb</span>
        </div>
      )}
    </div>
  )
}

function FilmRecommendationsResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: FilmRecommendations | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isFilmRecommendations(parsed)) data = parsed
    else if (isSingleFilm(parsed)) data = { films: [parsed] }
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // One item per film, deduped by title — recommending "Heat" again in
      // a later chat updates the same saved item rather than piling up
      // duplicates. Promise.all here means one film hitting the free-plan
      // item limit surfaces as the overall save failing (onError below),
      // even though any films saved before the limit was hit stay saved.
      const request = Promise.all(
        data.films.map((film) => saveItem(toolSlug, chatId, film.title, film, film.title.toLowerCase())),
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
    // it, the last film's content butts right up against the feedback
    // icons and reads as if they belong to that film specifically rather
    // than to the whole multi-film response.
    <div className="space-y-4 pb-2">
      {data.films.map((film) => (
        <FilmCard key={film.title} film={film} />
      ))}
    </div>
  )
}

export default FilmRecommendationsResponse
