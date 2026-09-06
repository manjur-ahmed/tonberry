import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { setPreferences } from '../lib/api'
import { countries } from '../lib/countries'
import Switch from '../components/Switch'

function Country() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [country, setCountryCode] = useState('')
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')

  const mutation = useMutation({
    mutationFn: setPreferences,
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user)
      navigate('/pricing', { replace: true })
    },
  })

  function handleThemeToggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  function handleContinue() {
    const trimmed = name.trim()
    if (!trimmed || !country) return

    const [firstName, ...rest] = trimmed.split(/\s+/)
    mutation.mutate({
      name: firstName,
      otherNames: rest.length > 0 ? rest.join(' ') : undefined,
      country,
      darkTheme: isDark,
    })
  }

  const canContinue = name.trim().length > 0 && country.length > 0

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-indigo-100 via-violet-50 to-white px-4 py-16">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
      <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />

      <h1 className="relative font-display text-3xl font-semibold leading-tight text-slate-900">
        Set your preferences
      </h1>
      <p className="relative mt-2 text-slate-600">A few details to get things set up.</p>

      <div className="relative mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-900">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            className="rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-900">Country</span>
          <select
            value={country}
            onChange={(event) => setCountryCode(event.target.value)}
            className="rounded-full border border-slate-200 bg-white/80 px-5 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="" disabled>
              Select a country
            </option>
            {countries.map((option) => (
              <option key={option.code} value={option.code}>
                {option.flag} {option.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-5 py-3 shadow-md shadow-slate-300/40">
          <span className="flex-1 text-sm font-semibold text-slate-900">Dark theme</span>
          <Switch checked={isDark} onChange={handleThemeToggle} />
        </div>

        <button
          type="button"
          disabled={!canContinue || mutation.isPending}
          onClick={handleContinue}
          className="mt-3 rounded-full bg-slate-900 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>

      {mutation.isError && (
        <p className="relative mt-4 text-sm text-red-600">Something went wrong — try again.</p>
      )}
    </main>
  )
}

export default Country
