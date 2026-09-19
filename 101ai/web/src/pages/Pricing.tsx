import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setPlan, startTrial } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { getCurrencySymbol } from '../lib/countries'
import { plans } from '../lib/plans'
import LegalLinksFooter from '../components/LegalLinksFooter'

const TRIAL_DAYS = 14

const headings: Record<string, { title: string; subtitle: string }> = {
  memory: {
    title: 'Unlock memory',
    subtitle: 'Upgrade to Plus or Premium to keep memory across chats.',
  },
  items: {
    title: 'Unlock unlimited items',
    subtitle: 'Upgrade to Plus or Premium to save as many items as you like.',
  },
}
const defaultHeading = { title: 'Choose a plan', subtitle: 'Monthly billing, cancel anytime.' }
// Shown instead of defaultHeading for a user who hasn't picked a real plan
// yet, whether they're mid-onboarding or already trialing — "limited
// trial" is accurate either way, not just before the trial's started.
const newUserHeading = {
  title: "You're on a limited trial, choose a plan",
  subtitle: 'Monthly billing, cancel anytime.',
}

function Pricing() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuth()
  const symbol = getCurrencySymbol(user?.country ?? null)
  const [searchParams] = useSearchParams()
  const reason = searchParams.get('reason')
  const heading = (reason && headings[reason]) || (!user?.plan ? newUserHeading : defaultHeading)
  // The trial offer itself only makes sense for someone who hasn't already
  // started it (or picked a real plan) — an existing trialing/paying user
  // revisiting this page (e.g. via Settings' "Upgrade") just sees the plan
  // row, not a second "start a trial" pitch.
  const canStartTrial = !user?.plan && !user?.trialStartedAt

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate('/sign-in', { replace: true })
    } else if (!user.country || !user.name) {
      navigate('/country', { replace: true })
    }
  }, [user, isLoading, navigate])

  const mutation = useMutation({
    mutationFn: setPlan,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser)
      navigate('/', { replace: true })
    },
  })

  const trialMutation = useMutation({
    mutationFn: startTrial,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['me'], updatedUser)
      navigate('/', { replace: true })
    },
  })

  const isBusy = mutation.isPending || trialMutation.isPending

  if (isLoading || !user || !user.country || !user.name) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-slate-600">Loading...</p>
      </main>
    )
  }

  return (
    <main
      className={`relative overflow-hidden bg-gradient-to-b from-indigo-100 via-violet-50 to-white px-4 pt-16 ${
        canStartTrial ? 'pb-36' : 'pb-16'
      }`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
      <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />

      <h1 className="relative font-display text-3xl font-extrabold leading-tight text-slate-900">
        {heading.title}
      </h1>
      <p className="relative mt-2 text-slate-600">{heading.subtitle}</p>

      {/* -mx-4/px-4 bleeds the row to the screen edges so the first/last
          card's shadow isn't clipped by the page's own padding — same
          hidden-scrollbar horizontal-scroll pattern Home.tsx's tool rows
          use. */}
      <div className="relative -mx-4 mt-8 flex gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {plans.map((plan) => (
          <div key={plan.id} className="relative w-64 flex-shrink-0">
            <div
              className={`rounded-2xl border-2 bg-white p-6 ${
                plan.popular ? 'border-slate-200' : 'border-slate-200'
              }`}
            >
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-900">
                {plan.name}
                {plan.popular && (
                  <span className="rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                    MOST POPULAR
                  </span>
                )}
              </h2>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {symbol}
                {plan.amount}
                <span className="text-base font-medium text-slate-500">/mo</span>
              </p>

              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => mutation.mutate(plan.id)}
                className="mt-6 w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {mutation.isError && (
        <p className="relative mt-4 text-center text-sm text-red-600">Something went wrong — try again.</p>
      )}

      <LegalLinksFooter />

      {canStartTrial && (
        // fixed, not sticky — see Chat.tsx's identical compose bar for why
        // (iOS doesn't shrink the layout viewport for the on-screen
        // keyboard, but there's no text input here; kept fixed anyway for
        // the same "always pinned above BottomNav" behavior, bottom-16
        // resting just above it).
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md bg-gradient-to-t from-white via-white/95 to-transparent px-4 pb-4 pt-8">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => trialMutation.mutate()}
            className="w-full rounded-full bg-slate-900 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {trialMutation.isPending ? 'Starting trial...' : 'Continue with free trial'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">Expires in {TRIAL_DAYS} days</p>
          {trialMutation.isError && (
            <p className="mt-2 text-center text-xs text-red-600">Something went wrong — try again.</p>
          )}
        </div>
      )}
    </main>
  )
}

export default Pricing
