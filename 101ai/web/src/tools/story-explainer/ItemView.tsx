interface StoryItemData {
  title: string
  year: string | null
  explanation: string
}

function isStoryItemData(value: unknown): value is StoryItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string'
}

// Heading combines title+year rather than baking that into the saved title
// itself (see ResponseView), the same way film-recommendations combines
// title+year for its own card. line-clamp-3 gives the start of the
// explanation with a trailing ellipsis once it overflows, same trick
// ToolCard uses for its description.
function StoryExplainerItemView({ title, data }: { title: string; data: unknown }) {
  if (!isStoryItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">
        {data.title}
        {data.year && <span className="text-slate-400"> ({data.year})</span>}
      </p>
      <p className="mt-2 line-clamp-3 text-sm text-slate-600">{data.explanation}</p>
    </div>
  )
}

export default StoryExplainerItemView
