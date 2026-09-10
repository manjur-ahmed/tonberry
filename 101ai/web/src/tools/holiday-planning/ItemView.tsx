interface HolidayPlanItemData {
  planTitle: string
  columns: string[]
  rows: string[][]
}

function isHolidayPlanItemData(value: unknown): value is HolidayPlanItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.planTitle === 'string' && Array.isArray(data.columns) && Array.isArray(data.rows)
}

// Column headers as a joined preview line ("Day • Activity • Notes") give a
// quick sense of what shape the plan took — an itinerary vs. a budget
// breakdown — without trying to cram a whole grid into a small tile.
function HolidayPlanningItemView({ title, data }: { title: string; data: unknown }) {
  if (!isHolidayPlanItemData(data)) {
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

export default HolidayPlanningItemView
