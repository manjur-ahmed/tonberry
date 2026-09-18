import { Pin, Play } from 'lucide-react'
import { formatPlays } from '../../lib/formatPlays'

interface SongItemData {
  title: string
  artist: string | null
  year: string | null
  genre: string | null
  summary: string | null
  spotifyPlays: number | null
}

function isSongItemData(value: unknown): value is SongItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string'
}

function MusicRecommendationsItemView({ title, data, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  if (!isSongItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {/* Always rendered, not just when pinned — a 2-column grid row with
            one pinned and one unpinned card would otherwise mismatch height. */}
        <div className="mb-1 text-slate-400">{pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> : ' '}</div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  // The card only has room for one category — genre can be a comma-separated
  // list (e.g. "Indie, Rock"), so just show the first one.
  const primaryGenre = data.genre?.split(',')[0]?.trim()

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-1 text-slate-400">{pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> : ' '}</div>
      <h3 className="font-display text-2xl font-bold text-slate-900">{data.title}</h3>
      {data.artist && <p className="mt-0.5 text-sm text-slate-500">{data.artist}</p>}
      {primaryGenre && <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{primaryGenre}</p>}
      {data.spotifyPlays != null && (
        <div className="mt-2 flex items-start gap-1 text-sm text-slate-700">
          <Play className="mt-[3px] h-4 w-4 text-emerald-500" strokeWidth={1.75} fill="currentColor" />
          <span>{formatPlays(data.spotifyPlays)} plays on Spotify</span>
        </div>
      )}
    </div>
  )
}

export default MusicRecommendationsItemView
