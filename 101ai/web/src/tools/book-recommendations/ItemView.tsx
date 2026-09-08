import { Star } from 'lucide-react'

interface BookItemData {
  title: string
  author: string | null
  year: string | null
  genre: string | null
  summary: string | null
  goodreadsRating: number | null
}

function isBookItemData(value: unknown): value is BookItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string'
}

function BookRecommendationsItemView({ title, data }: { title: string; data: unknown }) {
  if (!isBookItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-2xl font-bold text-slate-900">
        {data.title}
        {data.year && <span className="text-slate-400"> ({data.year})</span>}
      </h3>
      {data.author && <p className="mt-0.5 text-sm text-slate-500">{data.author}</p>}
      {data.genre && <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{data.genre}</p>}
      {data.summary && <p className="mt-2 text-sm text-slate-700">{data.summary}</p>}
      {data.goodreadsRating != null && (
        <div className="mt-2 flex items-center gap-1 text-sm text-slate-700">
          <Star className="h-4 w-4 text-amber-400" strokeWidth={1.75} fill="currentColor" />
          <span>{data.goodreadsRating.toFixed(1)}/5 on Goodreads</span>
        </div>
      )}
    </div>
  )
}

export default BookRecommendationsItemView
