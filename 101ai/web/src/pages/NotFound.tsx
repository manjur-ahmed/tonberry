import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

// The router's catch-all (`path: '*'`, see router.tsx) — any URL that
// doesn't match a real route lands here instead of React Router's raw
// blank screen. Also reused by RouteError for the "no such route" case of
// a thrown 404 response, so both paths to a bad URL end up at the same
// page.
function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-violet-700">
        <Compass className="h-8 w-8" strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-600">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        Go home
      </Link>
    </main>
  )
}

export default NotFound
