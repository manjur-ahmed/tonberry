import { useEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface Book {
  title: string
  author: string | null
  year: string | null
  genre: string | null
  summary: string | null
  whyRecommended: string | null
  goodreadsRating: number | null
}

interface BookRecommendations {
  books: Book[]
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with `books` empty and the
// reply text in `reply` instead; only a 'recommendations' reply with at
// least one book renders as a list or gets auto-saved. `kind` is missing on
// messages saved before this field existed — treat that as a (legacy)
// recommendations reply too, rather than failing the check and dumping raw
// JSON for old chat history.
function isBookRecommendations(value: unknown): value is BookRecommendations {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return Array.isArray(data.books) && data.books.length > 0
}

// A saved item's `data` is a single Book (see saveMutation below — one item
// per book, not the whole {books: [...]} reply envelope), so ItemDetailModal
// feeding item.data back through this same ResponseView (the way
// word-helper's item shape already matches its response shape) needs its
// own check rather than isBookRecommendations.
function isSingleBook(value: unknown): value is Book {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && !('books' in data) && !('kind' in data)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

// Dedup key includes the author, not just the title — unlike a film, two
// different books can share the exact same title.
function dedupKey(book: Book): string {
  return `${book.title}::${book.author ?? ''}`.toLowerCase()
}

function BookCard({ book }: { book: Book }) {
  return (
    <div className="bg-white pt-4">
      <h3 className="font-display text-xl font-bold text-slate-900">
        {book.title}
        {book.year && <span className="text-slate-400"> ({book.year})</span>}
      </h3>
      {book.author && <p className="mt-0.5 text-sm text-slate-500">{book.author}</p>}
      {book.genre && <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{book.genre}</p>}
      {book.summary && <p className="mt-3 text-sm text-slate-700">{book.summary}</p>}
      {book.whyRecommended && (
        <div className="mt-3">
          <Label>Why this one</Label>
          <p className="mt-1 text-sm text-slate-700">{book.whyRecommended}</p>
        </div>
      )}
      {book.goodreadsRating != null && (
        <div className="mt-3 flex items-center gap-1 text-sm text-slate-700">
          <Star className="h-4 w-4 text-amber-400" strokeWidth={1.75} fill="currentColor" />
          <span>{book.goodreadsRating.toFixed(1)}/5 on Goodreads</span>
        </div>
      )}
    </div>
  )
}

function BookRecommendationsResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: BookRecommendations | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isBookRecommendations(parsed)) data = parsed
    else if (isSingleBook(parsed)) data = { books: [parsed] }
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // One item per book, deduped by title+author — recommending "Dune"
      // again in a later chat updates the same saved item rather than
      // piling up duplicates. Promise.all here means one book hitting the
      // free-plan item limit surfaces as the overall save failing (onError
      // below), even though any books saved before the limit was hit stay
      // saved.
      const request = Promise.all(
        data.books.map((book) => saveItem(toolSlug, chatId, book.title, book, dedupKey(book))),
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
    // it, the last book's content butts right up against the feedback
    // icons and reads as if they belong to that book specifically rather
    // than to the whole multi-book response.
    <div className="space-y-4 pb-2">
      {data.books.map((book) => (
        <BookCard key={dedupKey(book)} book={book} />
      ))}
    </div>
  )
}

export default BookRecommendationsResponse
