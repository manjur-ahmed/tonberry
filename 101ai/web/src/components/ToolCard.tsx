import { Link } from 'react-router-dom'
import type { Tool, ToolCategory } from '../tools/registry'

const categoryStyles: Record<ToolCategory, { icon: string; shadow: string }> = {
  Education: { icon: 'bg-sky-100', shadow: 'bg-sky-200' },
  'Entertainment & Media': { icon: 'bg-fuchsia-100', shadow: 'bg-fuchsia-200' },
  Business: { icon: 'bg-indigo-100', shadow: 'bg-indigo-200' },
  'Personal Finance': { icon: 'bg-rose-100', shadow: 'bg-rose-200' },
  Shopping: { icon: 'bg-amber-100', shadow: 'bg-amber-200' },
  'Health & Wellbeing': { icon: 'bg-emerald-100', shadow: 'bg-emerald-200' },
  'Food & Cooking': { icon: 'bg-orange-100', shadow: 'bg-orange-200' },
  'Leisure & Events': { icon: 'bg-cyan-100', shadow: 'bg-cyan-200' },
  'Politics & Current Affairs': { icon: 'bg-violet-100', shadow: 'bg-violet-200' },
  'How-to & Fixes': { icon: 'bg-red-100', shadow: 'bg-red-200' },
}

interface ToolCardProps {
  tool: Tool
  // When set, the card acts as a picker tile (e.g. "open this item in
  // another tool") instead of navigating to the tool's own page.
  onSelect?: (tool: Tool) => void
  disabled?: boolean
}

function ToolCard({ tool, onSelect, disabled }: ToolCardProps) {
  const styles = categoryStyles[tool.category]

  const content = (
    <>
      <div className={`absolute inset-0 translate-x-1 translate-y-1 rounded-2xl ${styles.shadow}`} />
      <div className="relative flex h-full w-full flex-col gap-2 overflow-hidden rounded-2xl border-2 border-slate-900 bg-white p-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg ${styles.icon}`}>
          {tool.icon}
        </div>
        <div className="min-h-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-extrabold leading-tight text-slate-900">
            {tool.name}
          </h3>
          <p className="mt-1 line-clamp-4 text-xs text-slate-600">{tool.description}</p>
        </div>
      </div>
    </>
  )

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(tool)}
        disabled={disabled}
        className="relative block h-full w-full text-left disabled:opacity-40"
      >
        {content}
      </button>
    )
  }

  return (
    <Link to={`/tools/${tool.slug}`} className="relative block h-full w-full">
      {content}
    </Link>
  )
}

export default ToolCard
