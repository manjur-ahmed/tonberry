interface TechGuideItemData {
  problemTitle: string
  steps: string[]
}

function isTechGuideItemData(value: unknown): value is TechGuideItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.problemTitle === 'string' && Array.isArray(data.steps)
}

function TechItemView({ title, data }: { title: string; data: unknown }) {
  if (!isTechGuideItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-xl font-bold text-slate-900">{data.problemTitle}</h3>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
        {data.steps.length} {data.steps.length === 1 ? 'step' : 'steps'}
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{data.steps.join(' ')}</p>
    </div>
  )
}

export default TechItemView
