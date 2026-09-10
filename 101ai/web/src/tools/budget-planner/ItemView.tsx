interface BudgetPlanItemData {
  planTitle: string
  columns: string[]
  rows: string[][]
}

function isBudgetPlanItemData(value: unknown): value is BudgetPlanItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.planTitle === 'string' && Array.isArray(data.columns) && Array.isArray(data.rows)
}

// Column headers as a joined preview line ("Category • Type • Amount") give
// a quick sense of how the budget's organised without trying to cram a
// whole grid into a small tile.
function BudgetPlannerItemView({ title, data }: { title: string; data: unknown }) {
  if (!isBudgetPlanItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-xl font-bold text-slate-900">{data.planTitle}</h3>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
        {data.rows.length} {data.rows.length === 1 ? 'category' : 'categories'}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{data.columns.join(' • ')}</p>
    </div>
  )
}

export default BudgetPlannerItemView
