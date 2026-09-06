import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getTool } from '../tools/registry'
import { useAuth } from '../hooks/useAuth'

function ToolPage() {
  const { slug } = useParams<{ slug: string }>()
  const tool = slug ? getTool(slug) : undefined
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading || !tool || !user) return
    navigate(`/tools/${tool.slug}/dashboard`, { replace: true })
  }, [user, isLoading, tool, navigate])

  if (!tool) {
    return (
      <main className="px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Tool not found</h1>
        <Link to="/" className="mt-4 inline-block text-slate-600 underline">
          Back to all tools
        </Link>
      </main>
    )
  }

  if (isLoading || user) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-slate-600">Loading...</p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="self-start text-2xl text-slate-900"
      >
        ←
      </button>

      <div className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-100 via-indigo-50 to-white py-14">
        <div className="mx-auto flex h-20 w-20 animate-float items-center justify-center rounded-full bg-white text-4xl shadow-sm">
          {tool.icon}
        </div>
      </div>

      <h1 className="mt-6 font-display text-2xl font-semibold text-slate-900">{tool.name}</h1>
      <p className="mb-10 mt-2 text-slate-600">{tool.description}</p>

      <p className="mt-auto mb-2 text-center text-xs text-slate-400">
        You must be logged in to use this tool
      </p>
      <Link
        to="/sign-in?mode=signup"
        className="block w-full rounded-full bg-slate-900 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
      >
        Create an account
      </Link>
    </main>
  )
}

export default ToolPage
