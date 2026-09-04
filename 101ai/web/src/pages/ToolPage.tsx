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
    if (isLoading) return
    if (!user) {
      navigate('/sign-in', { replace: true })
    } else if (!user.plan) {
      navigate('/pricing', { replace: true })
    }
  }, [user, isLoading, navigate])

  if (!tool) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Tool not found</h1>
        <Link to="/" className="mt-4 inline-block text-slate-600 underline">
          Back to all tools
        </Link>
      </main>
    )
  }

  if (isLoading || !user || !user.plan) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-slate-600">Loading...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <div className="text-4xl">{tool.icon}</div>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">{tool.name}</h1>
      <p className="mt-2 text-slate-600">
        You're signed in on the {user.plan} plan — the real tool lands in Phase 3.
      </p>
    </main>
  )
}

export default ToolPage
