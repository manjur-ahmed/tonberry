interface ActivityItemData {
  title: string
  category: string | null
  duration: string | null
  description: string | null
}

function isActivityItemData(value: unknown): value is ActivityItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string'
}

function ActivityFinderItemView({ title, data }: { title: string; data: unknown }) {
  if (!isActivityItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-2xl font-bold text-slate-900">{data.title}</h3>
      {(data.category || data.duration) && (
        <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
          {[data.category, data.duration].filter(Boolean).join(' • ')}
        </p>
      )}
      {data.description && <p className="mt-2 text-sm text-slate-700">{data.description}</p>}
    </div>
  )
}

export default ActivityFinderItemView
