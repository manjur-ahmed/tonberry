import { QuoteCard, type Quote } from './ResponseView'

function isQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.text === 'string' && typeof data.source === 'string'
}

function QuoteFinderItemView({ title, data }: { title: string; data: unknown }) {
  if (!isQuote(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
    )
  }

  return (
    // pr-10, not px-4 — ToolDashboard overlays its "more options" button
    // (h-7 w-7 at right-2 top-2, see ToolDashboard.tsx) on top of every
    // item tile, and a long quote otherwise runs straight under it. The
    // extra right padding pushes the wrap point earlier so the quote text
    // never reaches that corner instead of the button covering it.
    <div className="rounded-2xl border border-slate-200 bg-white pl-4 pr-10 pb-4">
      <QuoteCard quote={data} showVerifyLink={false} />
    </div>
  )
}

export default QuoteFinderItemView
