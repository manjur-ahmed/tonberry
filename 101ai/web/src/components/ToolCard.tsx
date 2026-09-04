import { Link } from 'react-router-dom'
import type { Tool } from '../tools/registry'

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition"
    >
      <div className="text-3xl">{tool.icon}</div>
      <h3 className="mt-3 font-semibold text-slate-900">{tool.name}</h3>
      <p className="mt-1 text-sm text-slate-600">{tool.description}</p>
    </Link>
  )
}

export default ToolCard
