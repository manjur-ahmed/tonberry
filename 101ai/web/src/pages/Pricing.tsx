import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setPlan } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { getCurrencySymbol } from '../lib/countries'
import { plans } from '../lib/plans'

const headings: Record<string, { title: string; subtitle: string }> = {
  memory: {
    title: 'Unlock memory',
    subtitle: 'Upgrade to Plus or Premium to keep memory across chats.',
  },
}
const defaultHeading = { title: 'Choose a plan', subtitle: 'Monthly billing, cancel anytime.' }

function Pricing() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isLoading } = useAuth()
  const symbol = getCurrencySymbol(user?.country ?? null)
  const [searchParams] = useSearchParams()
  const heading = headings[searchParams.get('reason') ?? ''] ?? defaultHeading

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate('/sign-in', { replace: true })
    } else if (!user.country) {
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

  if (isLoading || !user || !user.country) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-slate-600">Loading...</p>
      </main>
    )
  }

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-indigo-100 via-violet-50 to-white px-4 py-16">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
      <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />

      <h1 className="relative font-display text-3xl font-semibold leading-tight text-slate-900">
        {heading.title}
      </h1>
      <p className="relative mt-2 text-slate-600">{heading.subtitle}</p>

      <div className="relative mt-8 flex flex-col gap-6">
        {plans.map((plan) => {
          const disabled = plan.id !== 'free' || mutation.isPending

          return (
            <div key={plan.id} className="relative">
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                  MOST POPULAR
                </span>
              )}
              <div
                className={`rounded-2xl border-2 bg-white p-6 ${
                  plan.popular ? 'border-slate-900' : 'border-slate-200'
                }`}
              >
                <h2 className="font-display text-xl font-semibold text-slate-900">{plan.name}</h2>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {symbol}
                  {plan.amount}
                  {plan.amount > 0 && <span className="text-base font-medium text-slate-500">/mo</span>}
                </p>

                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className={`mt-0.5 ${plan.id === 'free' ? 'text-slate-400' : 'text-emerald-500'}`}>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => mutation.mutate(plan.id)}
                  className="mt-6 w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {plan.id === 'free' ? 'Choose Free' : 'Coming soon'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {mutation.isError && (
        <p className="relative mt-4 text-center text-sm text-red-600">Something went wrong — try again.</p>
      )}
    </main>
  )
}

export default Pricing
