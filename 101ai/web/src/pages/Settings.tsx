import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Crown,
  Brain,
  LogOut,
  Mail,
  Moon,
  RotateCcw,
  Star,
  Sun,
  Trash2,
  UserX,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { setPlan } from '../lib/api'
import { getPlan, plans } from '../lib/plans'
import Switch from '../components/Switch'
import ConfirmDialog from '../components/ConfirmDialog'

type DialogKey = 'reset-chats' | 'remove-items' | 'unsubscribe' | 'delete-account'

const dialogContent: Record<DialogKey, { title: string; description: string; confirmLabel: string }> = {
  'reset-chats': {
    title: 'Reset all chats?',
    description: "This clears your chat history across every tool. This can't be undone.",
    confirmLabel: 'Reset chats',
  },
  'remove-items': {
    title: 'Remove all items?',
    description: "Every saved item across every tool will be deleted. This can't be undone.",
    confirmLabel: 'Remove items',
  },
  unsubscribe: {
    title: 'Unsubscribe?',
    description: "You'll move to the Free plan at the end of your current billing period.",
    confirmLabel: 'Unsubscribe',
  },
  'delete-account': {
    title: 'Delete your account?',
    description: "This permanently deletes your account and everything in it. This can't be undone.",
    confirmLabel: 'Delete account',
  },
}

function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [activeDialog, setActiveDialog] = useState<DialogKey | null>(null)

  useEffect(() => {
    if (!user) navigate('/sign-in', { replace: true })
  }, [user, navigate])

  const currentPlan = getPlan(user?.plan) ?? plans[0]
  const canUpgrade = currentPlan.id !== 'premium'
  const nextBillDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const unsubscribeMutation = useMutation({
    mutationFn: () => setPlan('free'),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser)
      setActiveDialog(null)
    },
  })

  function handleSignOut() {
    signOut()
    navigate('/', { replace: true })
  }

  function handleMemoryToggle() {
    if (currentPlan.id === 'free') {
      navigate('/pricing?reason=memory')
      return
    }
    setMemoryEnabled((value) => !value)
  }

  function handleThemeToggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  function handleConfirm() {
    if (activeDialog === 'unsubscribe') {
      unsubscribeMutation.mutate()
      return
    }
    if (activeDialog === 'delete-account') {
      signOut()
      navigate('/', { replace: true })
      return
    }
    // No chats/items data model exists yet — nothing to actually clear.
    setActiveDialog(null)
  }

  if (!user) return null

  const initial = (user.name ?? user.email).charAt(0).toUpperCase()

  return (
    <main className="px-4 py-6">
      <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-slate-900">
        <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <div className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-violet-100 text-3xl font-semibold text-violet-700">
        {initial}
      </div>
      <h1 className="mt-4 text-center font-display text-2xl font-semibold text-slate-900">
        {user.name ?? user.email}
      </h1>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-slate-900" strokeWidth={1.75} />
            <span className="font-display text-lg font-semibold text-slate-900">{currentPlan.name} plan</span>
          </div>
          {canUpgrade && (
            <button
              type="button"
              onClick={() => navigate('/pricing')}
              className="flex-shrink-0 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Upgrade
            </button>
          )}
        </div>

        <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
          {currentPlan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className={`mt-0.5 ${currentPlan.id === 'free' ? 'text-slate-400' : 'text-emerald-500'}`}>
                ✓
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {currentPlan.id !== 'free' && (
          <p className="mt-3 text-xs text-slate-400">Next bill: {nextBillDate}</p>
        )}
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500">Settings</h2>
      <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Brain className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium text-slate-900">Memory</span>
          <Switch checked={memoryEnabled} onChange={handleMemoryToggle} />
        </div>

        <div className="flex items-center gap-3 px-4 py-3.5">
          {isDark ? (
            <Moon className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
          ) : (
            <Sun className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
          )}
          <span className="flex-1 text-sm font-medium text-slate-900">Dark theme</span>
          <Switch checked={isDark} onChange={handleThemeToggle} />
        </div>

        <a href="mailto:support@101aitools.app" className="flex items-center gap-3 px-4 py-3.5">
          <Mail className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium text-slate-900">Contact us</span>
          <ChevronRight className="h-4 w-4 text-slate-300" />
        </a>

        <div className="flex items-center gap-3 px-4 py-3.5 opacity-50">
          <Star className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium text-slate-900">Rate our app</span>
          <span className="text-xs text-slate-400">Coming soon</span>
        </div>

        <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
          <LogOut className="h-5 w-5 text-slate-500" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium text-slate-900">Sign out</span>
        </button>
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-red-500">Danger Zone</h2>
      <div className="mt-3 divide-y divide-red-100 rounded-2xl border border-red-200 bg-red-50/40">
        <button
          type="button"
          onClick={() => setActiveDialog('reset-chats')}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-red-600"
        >
          <RotateCcw className="h-5 w-5" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium">Reset all chats</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDialog('remove-items')}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-red-600"
        >
          <Trash2 className="h-5 w-5" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium">Remove all items</span>
        </button>

        <button
          type="button"
          disabled={currentPlan.id === 'free'}
          onClick={() => setActiveDialog('unsubscribe')}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-red-600 disabled:opacity-40"
        >
          <Ban className="h-5 w-5" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium">Unsubscribe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDialog('delete-account')}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-red-600"
        >
          <UserX className="h-5 w-5" strokeWidth={1.75} />
          <span className="flex-1 text-sm font-medium">Delete account</span>
        </button>
      </div>

      {activeDialog && (
        <ConfirmDialog
          open
          title={dialogContent[activeDialog].title}
          description={dialogContent[activeDialog].description}
          confirmLabel={dialogContent[activeDialog].confirmLabel}
          onConfirm={handleConfirm}
          onCancel={() => setActiveDialog(null)}
        />
      )}
    </main>
  )
}

export default Settings
