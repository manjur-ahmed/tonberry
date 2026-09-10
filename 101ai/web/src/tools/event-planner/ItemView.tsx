interface EventPlanItemData {
  planTitle: string
  sections: { heading: string; body: string }[]
}

function isEventPlanItemData(value: unknown): value is EventPlanItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.planTitle === 'string' && Array.isArray(data.sections)
}

// The tile shows the event, how many sections the plan's grown to, and a
// line-clamp-3 preview of the first one, same trick ToolCard/
// story-explainer use for a trailing ellipsis.
function EventPlannerItemView({ title, data }: { title: string; data: unknown }) {
  if (!isEventPlanItemData(data) || data.sections.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{data.planTitle}</p>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
        {data.sections.length === 1 ? '1 section' : `${data.sections.length} sections`}
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{data.sections[0].body}</p>
    </div>
  )
}

export default EventPlannerItemView
