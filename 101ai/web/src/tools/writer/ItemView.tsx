interface NoteData {
  body: string
}

function isNoteData(value: unknown): value is NoteData {
  return !!value && typeof value === 'object' && typeof (value as Record<string, unknown>).body === 'string'
}

// One line of the note's own body under the title — line-clamp-1 rather
// than the line-clamp-3 preview other dense tools use (see
// career-planner/ItemView.tsx), since a note's tile is meant to read like a
// quick "what's in this" glance, not a mini excerpt.
function WriterItemView({ title, data }: { title: string; data: unknown }) {
  const body = isNoteData(data) ? data.body.trim() : ''
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {body && <p className="mt-1 line-clamp-1 text-sm text-slate-600">{body}</p>}
    </div>
  )
}

export default WriterItemView
