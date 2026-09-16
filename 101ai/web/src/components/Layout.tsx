import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { faro } from '@grafana/faro-react'
import BottomNav from './BottomNav'
import { useAuth } from '../hooks/useAuth'

function Layout() {
  const { user } = useAuth()

  // Tags the current session with the real user id in both Grafana Faro
  // and MS Clarity, so a specific customer's errors/recording/actions can
  // actually be found rather than scrubbing through anonymous sessions —
  // safe to call unconditionally even outside prod (both are real no-ops
  // there, see lib/faro.ts/lib/analytics.ts's hostname gates — nothing was
  // ever initialized to report to).
  useEffect(() => {
    if (!user) return
    faro.api.setUser({ id: user.id })
    window.clarity?.('identify', user.id)
    window.clarity?.('set', 'userId', user.id)
  }, [user])

  return (
    <div className="min-h-svh bg-white">
      <div className="relative mx-auto flex min-h-svh w-full max-w-md flex-col">
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </div>
  )
}

export default Layout
