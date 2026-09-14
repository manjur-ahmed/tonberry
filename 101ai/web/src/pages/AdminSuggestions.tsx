import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { getSuggestions } from '../lib/suggestions'

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Deliberately admin-only, unlinked from nav — reach it by URL (see
// AdminUsage's identical pattern/comment). The email check that actually
// matters lives entirely server-side (AdminGuard); a 403 here just means
// "not authorized", nothing on this page grants access on its own.
function AdminSuggestions() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) navigate('/sign-in', { replace: true })
  }, [user, isLoading, navigate])

  const { data, isLoading: isSuggestionsLoading, error } = useQuery({
    queryKey: ['suggestions'],
    queryFn: getSuggestions,
    enabled: !!user,
  })

  if (!user) return null

  const isForbidden = error instanceof Error && error.message.includes('403')

  return (
    <main className="flex flex-col gap-4 p-4 pb-24">
      <h1 className="font-display text-2xl font-semibold text-slate-900">Tool suggestions</h1>

      {isForbidden && <p className="text-slate-600">Not authorized — this page is restricted.</p>}
      {!isForbidden && error && <p className="text-red-600">Something went wrong: {(error as Error).message}</p>}
      {isSuggestionsLoading && <p className="text-slate-500">Loading…</p>}

      {data && data.length === 0 && <p className="text-slate-500">No suggestions yet.</p>}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.map((suggestion) => (
            <div key={suggestion.id} className="rounded-2xl border-2 border-slate-900 bg-white p-4">
              <p className="whitespace-pre-line text-sm text-slate-900">{suggestion.content}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{suggestion.userEmail}</span>
                <span>{formatDate(suggestion.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default AdminSuggestions
