import { Link } from 'react-router-dom'
import ApiStatus from './ApiStatus'

function Nav() {
  return (
    <header className="border-b border-slate-200">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          tonberry
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <ApiStatus />
          <Link to="/guides" className="hover:text-slate-900">
            Guides
          </Link>
          <Link
            to="/login"
            className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
          >
            Financer login
          </Link>
        </div>
      </nav>
    </header>
  )
}

export default Nav
