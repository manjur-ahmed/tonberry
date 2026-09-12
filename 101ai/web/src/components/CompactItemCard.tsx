import { categoryStyles, getTool } from '../tools/registry'

interface CompactItemCardProps {
  toolSlug: string
  title: string
  // Shrinks the card's own padding (icon size stays the same) so its total
  // height lands at exactly 64px (p-2 + h-12 icon) — matching the h-16
  // image thumbnail it sits next to in a compose bar's pending-attachment
  // row. Unset (the roomier p-4 default) everywhere else: the item
  // picker's rows and the card an attached item renders as inside a sent
  // message, neither of which needs to line up against anything else.
  compact?: boolean
}

// Icon-square + title only — no per-tool ItemView (which pulls in that
// tool's own description/sections/etc, sized for a dashboard grid, not a
// small preview). Used everywhere a saved item needs to show up small: the
// item picker's rows, the pending-attachment chip in a compose bar, and the
// compact card an attached item renders as inside a sent message.
function CompactItemCard({ toolSlug, title, compact }: CompactItemCardProps) {
  const tool = getTool(toolSlug)
  const styles = tool ? categoryStyles[tool.category] : undefined
  return (
    <div
      className={`flex w-full items-center rounded-2xl border border-slate-200 bg-white text-left ${compact ? 'gap-2 p-2' : 'gap-3 p-4'}`}
    >
      <span
        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xl ${styles?.icon ?? 'bg-slate-100'}`}
      >
        {tool?.icon ?? '📄'}
      </span>
      <span className={`line-clamp-2 font-semibold text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</span>
    </div>
  )
}

export default CompactItemCard
