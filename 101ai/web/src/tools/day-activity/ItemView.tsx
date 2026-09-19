import { useState } from 'react'
import { Pin } from 'lucide-react'
import { staticMapUrl } from '../../lib/activityPlanner'

interface ActivityVenue {
  placeId: string
  displayName: string
  lat: number
  lng: number
}

interface ActivityItemData {
  title: string
  category: string | null
  duration: string | null
  description: string | null
  suitableFor?: string | null
  venue?: ActivityVenue | null
}

function isActivityItemData(value: unknown): value is ActivityItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string'
}

// Once a real venue's resolved, its own name is the title — see
// ResponseView.tsx's identical helper.
function displayTitle(data: ActivityItemData): string {
  return data.venue?.displayName ?? data.title
}

function ActivityFinderItemView({ title, data, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  const [mapFailed, setMapFailed] = useState(false)

  if (!isActivityItemData(data)) {
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {data.venue && !mapFailed && (
        <img
          src={staticMapUrl(data.venue.lat, data.venue.lng)}
          alt=""
          className="aspect-square w-full object-cover"
          onError={() => setMapFailed(true)}
        />
      )}
      <div className="p-4">
        {pinned && (
          <div className="mb-1 text-slate-400">
            <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
        )}
        <h3 className="font-display text-2xl font-bold text-slate-900">{displayTitle(data)}</h3>
        {(data.category || data.duration) && (
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
            {[data.category, data.duration].filter(Boolean).join(' • ')}
          </p>
        )}
        {data.description && <p className="mt-2 text-sm text-slate-700">{data.description}</p>}
        {data.suitableFor && (
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Suitable for: </span>
            {data.suitableFor}
          </p>
        )}
      </div>
    </div>
  )
}

export default ActivityFinderItemView
