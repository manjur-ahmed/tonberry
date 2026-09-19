import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import NotFound from './NotFound'

// The router's errorElement (see router.tsx) — catches a thrown render/
// loader/action error anywhere in the tree, so a bug shows this instead of
// React Router's raw blank/error screen. A route response with a 404
// status (e.g. a loader that couldn't find its data) reuses the same
// NotFound page as an actual bad URL; anything else is a real crash.
function RouteError() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />
  }

  // Never silently discard this — same reasoning as logging real OpenAI
  // failures instead of dropping them: a production error with nothing in
  // the console is invisible to debug later.
  console.error('Unhandled route error:', error)

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
        <TriangleAlert className="h-8 w-8" strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-extrabold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-600">
        An unexpected error occurred. Try reloading the page, or head back home.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Reload
        </button>
        <Link
          to="/"
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Go home
        </Link>
      </div>
    </main>
  )
}

export default RouteError
