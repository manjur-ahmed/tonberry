import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { API_URL, fetchMe, login, setToken } from '../lib/api'

function SignIn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isSignup = searchParams.get('mode') === 'signup'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: async ({ token }) => {
      setToken(token)
      // Mirrors AuthCallback's gating — the destination page fetches its
      // own fresh ['me'] via useAuth, this just decides where to send them.
      const user = await fetchMe()
      navigate(user?.plan && user?.country && user?.name ? '/' : '/pricing', { replace: true })
    },
  })

  function handleLogin() {
    if (!email.trim() || !password.trim()) return
    loginMutation.mutate()
  }

  return (
    <main className="relative overflow-hidden bg-gradient-to-b from-indigo-100 via-violet-50 to-white px-4 py-16">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-300/40 blur-2xl" />
      <div className="pointer-events-none absolute -left-16 top-20 h-32 w-32 rounded-full bg-indigo-200/50 blur-2xl" />

      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="relative text-2xl text-slate-900"
      >
        ←
      </button>

      <h1 className="relative mt-6 font-display text-3xl font-semibold leading-tight text-slate-900">
        {isSignup ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="relative mt-2 text-slate-600">
        {isSignup ? 'Sign up to start using any tool.' : 'Sign in to use any tool.'}
      </p>

      <a
        href={`${API_URL}/auth/google`}
        className="relative mt-8 block w-full rounded-full bg-slate-900 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700"
      >
        Continue with Google
      </a>

      <div className="relative mt-6 flex items-center gap-3 text-xs font-medium text-slate-400">
        <div className="h-px flex-1 bg-slate-300/60" />
        or
        <div className="h-px flex-1 bg-slate-300/60" />
      </div>

      <form
        className="relative mt-6 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!isSignup) handleLogin()
        }}
      >
        {isSignup && (
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            // text-base, not text-sm — avoids iOS Safari's auto-zoom-on-focus
            // for inputs under 16px.
            className="rounded-full border border-white/60 bg-white/70 px-5 py-3 text-base text-slate-900 shadow-md shadow-slate-300/40 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          className="rounded-full border border-white/60 bg-white/70 px-5 py-3 text-base text-slate-900 shadow-md shadow-slate-300/40 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
          className="rounded-full border border-white/60 bg-white/70 px-5 py-3 text-base text-slate-900 shadow-md shadow-slate-300/40 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />

        {isSignup ? (
          <>
            <button
              type="button"
              disabled
              className="mt-2 w-full cursor-not-allowed rounded-full bg-slate-300 py-3 text-sm font-semibold text-slate-500"
            >
              Continue
            </button>
            <p className="text-center text-xs text-slate-400">
              Email sign-up is coming soon — use Google for now.
            </p>
          </>
        ) : (
          <>
            <button
              type="submit"
              disabled={!email.trim() || !password.trim() || loginMutation.isPending}
              className="mt-2 w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Continue'}
            </button>
            {loginMutation.isError && (
              <p className="text-center text-xs text-red-600">{(loginMutation.error as Error).message}</p>
            )}
          </>
        )}
      </form>
    </main>
  )
}

export default SignIn
