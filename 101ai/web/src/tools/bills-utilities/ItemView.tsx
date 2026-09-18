import { Pin } from 'lucide-react'
import { renderInline } from './renderInline'

interface TopicItemData {
  title: string
  sections: { heading: string; body: string }[]
}

function isTopicItemData(value: unknown): value is TopicItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && Array.isArray(data.sections)
}

// The tile shows the umbrella topic, how many subheadings it's grown to,
// and a line-clamp-3 preview of the first one, same trick ToolCard/
// story-explainer use for a trailing ellipsis.
function BillsUtilitiesItemView({ title, data, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  if (!isTopicItemData(data) || data.sections.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {/* Always rendered, not just when pinned — a 2-column grid row with
            one pinned and one unpinned card would otherwise mismatch height. */}
        <div className="mb-1 text-slate-400">{pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> : ' '}</div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-1 text-slate-400">{pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> : ' '}</div>
      <p className="text-sm font-semibold text-slate-900">{data.title}</p>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
        {data.sections.length === 1 ? '1 topic' : `${data.sections.length} topics`} covered
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{renderInline(data.sections[0].body)}</p>
    </div>
  )
}

export default BillsUtilitiesItemView
