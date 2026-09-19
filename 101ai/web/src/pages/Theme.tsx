import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { setPreferences } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import Switch from '../components/Switch'

// Standing in for "a screenshot of the app" — no real dark theme exists
// anywhere else in the app yet (see TODO), so there's nothing real to
// screenshot. Small enough to read as a stand-in, not a literal claim.
function AppMockup({ dark }: { dark: boolean }) {
  return (
    <div
      className={`w-36 overflow-hidden rounded-2xl border shadow-lg transition-colors ${
        dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
      }`}
    >
      <div className={`flex items-center gap-2 px-3 py-2.5 ${dark ? 'bg-slate-800' : 'bg-slate-50'}`}>
        <div className={`h-2.5 w-2.5 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
        <div className={`h-2 w-12 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className={`h-2.5 w-3/4 rounded-full ${dark ? 'bg-slate-100' : 'bg-slate-800'}`} />
        <div className={`h-2 w-full rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-200'}`} />
        <div className={`h-2 w-5/6 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-200'}`} />
        <div className={`mt-1 h-8 w-full rounded-lg ${dark ? 'bg-violet-500' : 'bg-slate-900'}`} />
      </div>
    </div>
  )
}

// Step 3 of onboarding (Country -> Location -> Theme -> Pricing) — also
// reachable afterward from Settings ("Theme" row), which is why this reads
// the current value from the real user record (not local-only state) and
// always saves via a real PATCH, rather than assuming it's always mid-
// onboarding.
function Theme() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [isDark, setIsDark] = useState(() => user?.darkTheme ?? localStorage.getItem('theme') === 'dark')

  // user loads asynchronously (useAuth's own ['me'] fetch) — if it wasn't
  // ready yet on first render, sync the toggle once it is rather than
  // leaving it stuck on the pre-fetch fallback.
  useEffect(() => {
    if (user) setIsDark(user.darkTheme)
  }, [user])

  const mutation = useMutation({
    mutationFn: () => setPreferences({ darkTheme: isDark }),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser)
      document.documentElement.classList.toggle('dark', isDark)
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
      // Mid-onboarding (no plan chosen and no trial started yet) continues
      // to Pricing; an already-onboarded user (real plan OR mid-trial) who
      // opened this from Settings goes back there instead.
      navigate(user?.plan || user?.trialStartedAt ? '/settings' : '/pricing', { replace: true })
    },
  })

  return (
    // Conditional classes straight off `isDark`, not a Tailwind `dark:`
    // variant + a class on <html> — that only takes effect after saving
    // (see mutation.onSuccess above), but this page needs to actually shift
    // live as the toggle moves, before anything's been saved at all.
    <main
      className={`relative overflow-hidden px-4 py-16 transition-colors ${
        isDark ? 'bg-slate-900' : 'bg-gradient-to-b from-indigo-100 via-violet-50 to-white'
      }`}
    >
      {!isDark && (
        <>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
          <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />
        </>
      )}

      <h1
        className={`relative font-display text-3xl font-extrabold leading-tight transition-colors ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        Pick a theme
      </h1>

      {/* The image and its label swap sides as the toggle flips, rather
          than just swapping the image in place — light mode: mockup on
          the left, "Light" label on the right; dark mode: "Dark" label on
          the left, mockup on the right. */}
      <div className="relative mt-10 flex items-center justify-between gap-4">
        <div className="flex-1">
          {isDark ? (
            <span className="font-display text-2xl font-extrabold text-white">Dark</span>
          ) : (
            <AppMockup dark={false} />
          )}
        </div>
        <div className="flex flex-1 justify-end">
          {isDark ? (
            <AppMockup dark />
          ) : (
            <span className="font-display text-2xl font-extrabold text-slate-900">Light</span>
          )}
        </div>
      </div>

      <div className="relative mt-8 flex justify-center">
        <Switch checked={isDark} onChange={() => setIsDark((value) => !value)} onLabel="" offLabel="" />
      </div>

      <button
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className={`relative mt-8 w-full rounded-full py-3 text-center text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isDark ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-700'
        }`}
      >
        Continue
      </button>

      {mutation.isError && (
        <p className="relative mt-4 text-center text-sm text-red-600">Something went wrong — try again.</p>
      )}
    </main>
  )
}

export default Theme
