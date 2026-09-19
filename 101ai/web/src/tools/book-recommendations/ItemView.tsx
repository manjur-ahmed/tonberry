import { Pin, Star } from 'lucide-react'

interface ReadItemData {
  title: string
  author: string | null
  year: string | null
  format: string | null
  genre: string | null
  summary: string | null
  rating: number | null
  ratingSource: string | null
  image?: { url: string; source: string }
}

function isReadItemData(value: unknown): value is ReadItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string'
}

function ReadRecommendationsItemView({ title, data, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  if (!isReadItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {pinned && (
          <div className="mb-1 text-slate-400">
            <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
        )}
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      {data.image && (
        <img src={data.image.url} alt="" className="aspect-[2/3] w-12 flex-shrink-0 rounded-md object-cover" />
      )}
      <div className="min-w-0">
        {pinned && (
          <div className="mb-1 text-slate-400">
            <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
        )}
        <h3 className="font-display text-2xl font-bold text-slate-900">
          {data.title}
          {data.year && <span className="text-slate-400"> ({data.year})</span>}
        </h3>
        {data.author && <p className="mt-0.5 text-sm text-slate-500">{data.author}</p>}
        {(data.format || data.genre) && (
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {[data.format, data.genre].filter(Boolean).join(' · ')}
          </p>
        )}
        {data.summary && <p className="mt-2 text-sm text-slate-700">{data.summary}</p>}
        {data.rating != null && data.ratingSource && (
          <div className="mt-2 flex items-center gap-1 text-sm text-slate-700">
            <Star className="h-4 w-4 text-amber-400" strokeWidth={1.75} fill="currentColor" />
            <span>{data.rating.toFixed(1)}/5 on {data.ratingSource}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReadRecommendationsItemView
