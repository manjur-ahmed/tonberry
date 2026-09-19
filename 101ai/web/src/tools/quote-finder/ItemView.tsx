import { Pin } from 'lucide-react'
import { QuoteCard, type Quote } from './ResponseView'

function isQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.text === 'string' && typeof data.source === 'string'
}

function QuoteFinderItemView({ title, data, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  if (!isQuote(data)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {pinned && (
          <div className="mb-1 text-slate-400">
            <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
        )}
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
      {pinned && (
        <div className="pt-4 text-slate-400">
          <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      )}
      <QuoteCard quote={data} />
    </div>
  )
}

export default QuoteFinderItemView
