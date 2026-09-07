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

function WordHelperItemView({ title, data }: { title: string; data: unknown }) {
  if (!isWordItemData(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-display text-2xl font-bold text-slate-900">{data.word.toLowerCase()}</h3>
      {data.phonetic && <p className="mt-0.5 text-sm text-slate-400">{data.phonetic}</p>}
      {data.shortDefinition && (
        <p className="mt-2 text-sm font-semibold text-slate-900">{data.shortDefinition}</p>
      )}
    </div>
  )
}

export default WordHelperItemView
