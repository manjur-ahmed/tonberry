interface AdListingItemData {
  itemTitle: string
  platform: string | null
  description: string | null
  suggestedPrice: string | null
}

function isAdListingItemData(value: unknown): value is AdListingItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.itemTitle === 'string'
}

function AdCreatorItemView({ title, data }: { title: string; data: unknown }) {
  if (!isAdListingItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-xl font-bold text-slate-900">{data.itemTitle}</h3>
      {(data.platform || data.suggestedPrice) && (
        <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
          {[data.platform, data.suggestedPrice].filter(Boolean).join(' • ')}
        </p>
      )}
      {data.description && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{data.description}</p>}
    </div>
  )
}

export default AdCreatorItemView
