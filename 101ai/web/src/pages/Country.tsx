import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { setCountry } from '../lib/api'
import { countries } from '../lib/countries'

function Country() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: setCountry,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
      navigate('/pricing', { replace: true })
    },
  })

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-indigo-100 via-violet-50 to-white px-4 py-16">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
      <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />

      <h1 className="relative font-display text-3xl font-semibold leading-tight text-slate-900">
        Where are you based?
      </h1>
      <p className="relative mt-2 text-slate-600">We use this to show pricing in your currency.</p>

      <div className="relative mt-8 flex flex-col gap-3">
        {countries.map((country) => (
          <button
            key={country.code}
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(country.code)}
            className="flex items-center gap-3 rounded-full border border-white/60 bg-white/70 px-5 py-3 text-left text-sm font-semibold text-slate-900 shadow-md shadow-slate-300/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-lg">{country.flag}</span>
            {country.name}
          </button>
        ))}
      </div>

      {mutation.isError && (
        <p className="relative mt-4 text-sm text-red-600">Something went wrong — try again.</p>
      )}
    </main>
  )
}

export default Country
