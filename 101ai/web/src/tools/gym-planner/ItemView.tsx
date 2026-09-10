interface GymPlanItemData {
  planTitle: string
  columns: string[]
  rows: string[][]
}

function isGymPlanItemData(value: unknown): value is GymPlanItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.planTitle === 'string' && Array.isArray(data.columns) && Array.isArray(data.rows)
}

// Column headers as a joined preview line ("Day • Exercise • Sets • Reps")
// give a quick sense of what shape the plan took — a weekly split vs. a
// single session — without trying to cram a whole grid into a small tile.
function GymPlannerItemView({ title, data }: { title: string; data: unknown }) {
  if (!isGymPlanItemData(data)) {
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
        {data.rows.length} {data.rows.length === 1 ? 'row' : 'rows'}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{data.columns.join(' • ')}</p>
    </div>
  )
}

export default GymPlannerItemView
