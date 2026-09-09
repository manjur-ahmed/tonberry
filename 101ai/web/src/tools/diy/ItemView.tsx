interface DiyGuideItemData {
  guideTitle: string
  steps: string[]
}

function isDiyGuideItemData(value: unknown): value is DiyGuideItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.guideTitle === 'string' && Array.isArray(data.steps)
}

function DiyItemView({ title, data }: { title: string; data: unknown }) {
  if (!isDiyGuideItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-xl font-bold text-slate-900">{data.guideTitle}</h3>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
        {data.steps.length} {data.steps.length === 1 ? 'step' : 'steps'}
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{data.steps.join(' ')}</p>
    </div>
  )
}

export default DiyItemView
