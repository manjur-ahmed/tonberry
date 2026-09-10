interface SalaryCalculationItemData {
  planTitle: string
  columns: string[]
  rows: string[][]
}

function isSalaryCalculationItemData(value: unknown): value is SalaryCalculationItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.planTitle === 'string' && Array.isArray(data.columns) && Array.isArray(data.rows)
}

// Column headers as a joined preview line ("Gross Salary • Income Tax •
// National Insurance • Take-Home Pay") give a quick sense of the breakdown
// without trying to cram the whole table into a small tile.
function SalaryCalculatorItemView({ title, data }: { title: string; data: unknown }) {
  if (!isSalaryCalculationItemData(data)) {
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

export default SalaryCalculatorItemView
