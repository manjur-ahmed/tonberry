import { Link, useLocation } from 'react-router-dom'
import { CircleUserRound, History, Home } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

function BottomNav() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const profileTo = user ? '/settings' : '/sign-in'
  const profileActive = pathname === '/settings' || pathname === '/sign-in'

  const tabs = [
    { to: '/', label: 'Home', active: pathname === '/', icon: <Home className="h-5 w-5" strokeWidth={1.75} /> },
    {
      to: '/recent',
      label: 'Recent',
      active: pathname === '/recent',
      icon: <History className="h-5 w-5" strokeWidth={1.75} />,
    },
    {
      to: profileTo,
      label: 'Profile',
      active: profileActive,
      icon: <CircleUserRound className="h-5 w-5" strokeWidth={1.75} />,
    },
  ]

  return (
    <nav className="sticky bottom-0 flex border-t border-slate-200 bg-white/90 backdrop-blur">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          to={tab.to}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
            tab.active ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          {tab.icon}
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

export default BottomNav
