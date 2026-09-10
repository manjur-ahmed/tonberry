import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface DietPlan {
  // Stable per-plan id assigned by the model (see tool-config.ts) — same
  // mechanism as cooking's dishKey. Reused across every reply that amends
  // the same plan, only changing when the user asks for a genuinely
  // different one. Combined with chatId for the actual dedup key, so two
  // different plans in one chat don't collapse into a single item.
  planKey: string
  planTitle: string
  columns: string[]
  rows: string[][]
}

// `kind: 'chat'` replies (getting to know the user, small talk, follow-up
// questions — see tool-config.ts) carry the same envelope with the rest
// null and the reply text in `reply` instead; only a 'plan' reply renders
// as a table or gets auto-saved.
function isDietPlan(value: unknown): value is DietPlan {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return (
    typeof data.planKey === 'string' &&
    typeof data.planTitle === 'string' &&
    Array.isArray(data.columns) &&
    Array.isArray(data.rows)
  )
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

interface FormattedRow {
  label: string | null
  value: string
}

interface PlanGroup {
  label: string
  rows: FormattedRow[]
}

// A table doesn't work well on a phone-width screen — squeezed columns or
// constant horizontal scrolling either way. columns/rows is a generic
// shape (see tool-config.ts) so this has to work for however many columns
// the model picked: every column but the last becomes a bold label prefix
// (e.g. "Monday – Breakfast" for a Day/Meal/Food schedule, just "Calories"
// for a plain two-column table), and the last column is the value after it.
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
  // A blank leading cell is the model's way of saying "same day as the row
  // above" (a common table convention), not an empty group of its own —
  // forward-fill it before grouping so a run of blanks after one real day
  // label doesn't collapse into a single group merging meals from every
  // day together.
  let lastLabel = ''
  const firstColumnValues = rows.map((row) => {
    const value = (row[0] ?? '').trim()
    if (value) lastLabel = value
    return value || lastLabel
  })
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

function DietResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
  let data: DietPlan | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isDietPlan(parsed)) data = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // Dedup key is chatId + planKey, not the plan title — see cooking's
      // ResponseView for why (a title can change as the plan gets amended,
      // planKey is what stays stable across that).
      const request = saveItem(toolSlug, chatId, data.planTitle, data, `${chatId}:${data.planKey}`)
      // This resolves near-instantly today, but the spinner should still
      // read as a spinner rather than flash by — holds it open at least
      // this long regardless of how fast (or slow, once real) the save is.
      return withMinDuration(request, MIN_SAVE_SPINNER_MS)
    },
    onMutate: () => onSaveStatusChange?.('saving'),
    onSuccess: () => {
      markItemSavedForMessage(messageId)
      onSaveStatusChange?.('saved')
    },
    onError: (error) => {
      onSaveStatusChange?.(error instanceof ItemLimitReachedError ? 'limit-reached' : 'error')
    },
  })

  // Every plan reply is worth saving, so it happens automatically rather
  // than waiting on a user click. Runs once per message instance (component
  // is freshly mounted per message.id) — the ref guard is only to dodge
  // StrictMode's dev-mode double-invoke; the dedup key already makes a
  // genuine double-call harmless either way.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose item already saved successfully skips straight to
  // "saved" instead of re-running the save (and, if the item limit's since
  // been hit, flashing an error on something that's already safely stored).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (!data || readOnly) return
    if (hasSavedItemForMessage(messageId)) {
      onSaveStatusChange?.('saved')
      return
    }
    if (hasSavedRef.current) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  const groups = groupRows(data.columns, data.rows)

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-slate-900">{data.planTitle}</h2>

      {groups ? (
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
      ) : (
        <ul className="mt-4 space-y-3">
          {data.rows.map((row, rowIndex) => (
            <PlanRow key={rowIndex} {...formatRow(data.columns, row)} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default DietResponse
