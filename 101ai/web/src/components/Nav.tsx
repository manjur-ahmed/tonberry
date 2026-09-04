import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Nav() {
  const { user, signOut } = useAuth()

  return (
    <header className="border-b border-slate-200">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          101 AI Tools
        </Link>
        {user ? (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{user.name ?? user.email}</span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            to="/sign-in"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  )
}

export default Nav
