import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { submitSuggestion } from '../lib/suggestions'

function RecommendTool() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [content, setContent] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!user) navigate('/sign-in', { replace: true })
  }, [user, navigate])

  const mutation = useMutation({
    mutationFn: () => submitSuggestion(content.trim()),
    onSuccess: () => {
      setContent('')
      setSubmitted(true)
    },
  })

  if (!user) return null

  return (
    <main className="px-4 py-6">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-slate-900">
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-900">Recommend a tool</h1>
      <p className="mt-2 text-sm text-slate-600">
        Tell us what tool you'd like to see, or how an existing one could be better. We read every suggestion.
      </p>

      {submitted ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-sm font-medium text-emerald-800">Thanks — your suggestion's been sent.</p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-3 text-sm font-semibold text-emerald-700 underline"
          >
            Send another
          </button>
        </div>
      ) : (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (content.trim().length > 0) mutation.mutate()
          }}
        >
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="e.g. A tool that helps me plan a weekly grocery list..."
            rows={8}
            maxLength={4000}
            className="resize-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />

          <button
            type="submit"
            disabled={mutation.isPending || content.trim().length === 0}
            className="mt-1 w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? 'Sending...' : 'Send suggestion'}
          </button>

          {mutation.isError && (
            <p className="text-center text-sm text-red-600">Something went wrong — try again.</p>
          )}
        </form>
      )}
    </main>
  )
}

export default RecommendTool
