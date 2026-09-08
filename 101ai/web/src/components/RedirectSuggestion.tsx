import { useNavigate } from 'react-router-dom'
import { getTool } from '../tools/registry'

function RedirectSuggestion({ toolSlug, onStayHere }: { toolSlug: string; onStayHere: () => void }) {
  const navigate = useNavigate()
  const tool = getTool(toolSlug)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
      <p className="text-sm text-slate-600">
        This sounds like a job for <span className="font-semibold text-slate-900">{tool?.name ?? toolSlug}</span>.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onStayHere}
          className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Stay here
        </button>
        <button
          type="button"
          onClick={() => navigate(`/tools/${toolSlug}/dashboard`)}
          className="flex-1 rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Switch to {tool?.name ?? toolSlug}
        </button>
      </div>
    </div>
  )
}

export default RedirectSuggestion
