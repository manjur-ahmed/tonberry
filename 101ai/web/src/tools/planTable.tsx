// Shared by Diet Planner and Self Care (and any future tool with the same
// generic columns/rows shape — see tool-config.ts's PLAN_SCHEMA) — renders
// a table as a bulleted list instead, since a real <table> doesn't work
// well on a phone-width screen (squeezed columns or constant horizontal
// scrolling either way).

interface FormattedRow {
  label: string | null
  value: string
}

interface PlanGroup {
  label: string
  rows: FormattedRow[]
}

// columns/rows is a generic shape so this has to work for however many
// columns the model picked: every column but the last becomes a bold label
// prefix (e.g. "Monday – Breakfast" for a Day/Meal/Food schedule, just
// "Calories" for a plain two-column table), and the last column is the
// value after it.
function formatRow(columns: string[], row: string[]): FormattedRow {
  if (columns.length <= 1) return { label: null, value: row[0] ?? '' }
  return { label: row.slice(0, -1).join(' – '), value: row[row.length - 1] ?? '' }
}

// Sub-points, but only when they'd actually save repetition — a Day/Meal/
// Food schedule reads much better as "Monday" with Breakfast/Lunch/Dinner
// nested under it than as three separate "Monday – Breakfast", "Monday –
// Lunch" bullets. Needs 3+ columns (nothing left to nest under 1-2) *and*
// the first column repeating across rows — a table where every row's first
// cell is already unique gains nothing from grouping, so it stays flat.
function groupRows(columns: string[], rows: string[][]): PlanGroup[] | null {
  if (columns.length < 3) return null
  const firstColumnValues = rows.map((row) => row[0] ?? '')
  if (new Set(firstColumnValues).size === firstColumnValues.length) return null

  const groups: PlanGroup[] = []
  const groupIndexByLabel = new Map<string, number>()
  const restColumns = columns.slice(1)
  for (let i = 0; i < rows.length; i++) {
    const groupLabel = firstColumnValues[i]
    const formatted = formatRow(restColumns, rows[i].slice(1))
    const existingIndex = groupIndexByLabel.get(groupLabel)
    if (existingIndex !== undefined) {
      groups[existingIndex].rows.push(formatted)
    } else {
      groupIndexByLabel.set(groupLabel, groups.length)
      groups.push({ label: groupLabel, rows: [formatted] })
    }
  }
  return groups
}

function PlanRow({ label, value }: FormattedRow) {
  return (
    <li className="flex gap-2 text-sm text-slate-700">
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-300" />
      <span>
        {label && <span className="font-semibold text-slate-900">{label}: </span>}
        {value}
      </span>
    </li>
  )
}

export function PlanRows({ columns, rows }: { columns: string[]; rows: string[][] }) {
  const groups = groupRows(columns, rows)

  if (groups) {
    return (
      <ul className="mt-4 space-y-4">
        {groups.map((group, groupIndex) => (
          <li key={groupIndex}>
            <p className="text-sm font-semibold text-slate-900">{group.label}</p>
            <ul className="mt-1.5 space-y-1.5 pl-3.5">
              {group.rows.map((row, rowIndex) => (
                <PlanRow key={rowIndex} label={row.label} value={row.value} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="mt-4 space-y-3">
      {rows.map((row, rowIndex) => (
        <PlanRow key={rowIndex} {...formatRow(columns, row)} />
      ))}
    </ul>
  )
}
