import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { setPlan } from '../lib/api'

const plans = [
  { id: 'free' as const, name: 'Free', price: '£0', blurb: 'Get started with core tools.' },
  { id: 'plus' as const, name: 'Plus', price: '£—', blurb: 'Coming soon.' },
  { id: 'premium' as const, name: 'Premium', price: '£—', blurb: 'Coming soon.' },
]

function Pricing() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: setPlan,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
      navigate('/', { replace: true })
    },
  })

  return (
    <main className="mx-auto max-w-4xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Choose a plan</h1>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {plans.map((plan) => {
          const disabled = plan.id !== 'free' || mutation.isPending
          return (
            <div key={plan.id} className="rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900">{plan.name}</h2>
              <p className="mt-2 text-2xl font-bold">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-600">{plan.blurb}</p>
              <button
                type="button"
                disabled={disabled}
                onClick={() => mutation.mutate(plan.id)}
                className="mt-4 w-full rounded-md bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {plan.id === 'free' ? 'Choose Free' : 'Coming soon'}
              </button>
            </div>
          )
        })}
      </div>
      {mutation.isError && (
        <p className="mt-4 text-sm text-red-600">Something went wrong — try again.</p>
      )}
    </main>
  )
}

export default Pricing
