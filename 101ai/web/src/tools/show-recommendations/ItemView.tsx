import { Star } from 'lucide-react'

interface ShowItemData {
  title: string
  year: string | null
  genre: string | null
  summary: string | null
  imdbRating: number | null
  image?: { url: string; source: string }
}

function isShowItemData(value: unknown): value is ShowItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string'
}

function ShowRecommendationsItemView({ title, data }: { title: string; data: unknown }) {
  if (!isShowItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
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
        <h3 className="font-display text-2xl font-bold text-slate-900">
          {data.title}
          {data.year && <span className="text-slate-400"> ({data.year})</span>}
        </h3>
        {data.genre && <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{data.genre}</p>}
        {data.summary && <p className="mt-2 text-sm text-slate-700">{data.summary}</p>}
        {data.imdbRating != null && (
          <div className="mt-2 flex items-center gap-1 text-sm text-slate-700">
            <Star className="h-4 w-4 text-amber-400" strokeWidth={1.75} fill="currentColor" />
            <span>{data.imdbRating.toFixed(1)}/10 on IMDb</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ShowRecommendationsItemView
