import { Pin } from 'lucide-react'

interface MathsSolutionItemData {
  problemTitle: string
  steps: string[]
  answer: string
}

function isMathsSolutionItemData(value: unknown): value is MathsSolutionItemData {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.problemTitle === 'string' && Array.isArray(data.steps) && typeof data.answer === 'string'
}

function MathsSolverItemView({ title, data, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  if (!isMathsSolutionItemData(data)) {
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {pinned && (
        <div className="mb-1 text-slate-400">
          <Pin className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="font-display text-xl font-bold text-slate-900">{data.problemTitle}</h3>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
        {data.steps.length} {data.steps.length === 1 ? 'step' : 'steps'}
      </p>
      <p className="mt-2 line-clamp-1 text-sm font-semibold text-emerald-700">Answer: {data.answer}</p>
    </div>
  )
}

export default MathsSolverItemView
