import { Pin } from 'lucide-react'

interface WordItemData {
  word: string
  phonetic: string
  shortDefinition: string
}

function isWordItemData(value: unknown): value is WordItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.word === 'string'
}

function WordHelperItemView({ title, data, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  if (!isWordItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {/* Always rendered, not just when pinned — a 2-column grid row
            with one pinned and one unpinned card would otherwise mismatch
            height. The whitespace keeps this line's height the same as
            when it actually holds the pin icon. */}
        <div className="mb-1 text-slate-400">{pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> : ' '}</div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-1 text-slate-400">{pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> : ' '}</div>
      <h3 className="font-display text-2xl font-bold text-slate-900">{data.word.toLowerCase()}</h3>
      {data.phonetic && <p className="mt-0.5 text-sm text-slate-400">{data.phonetic}</p>}
      {data.shortDefinition && (
        <p className="mt-2 text-sm font-semibold text-slate-900">{data.shortDefinition}</p>
      )}
    </div>
  )
}

export default WordHelperItemView
