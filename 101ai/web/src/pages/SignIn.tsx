import { API_URL } from '../lib/api'

function SignIn() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-2 text-slate-600">Sign in to use any tool.</p>
      <a
        href={`${API_URL}/auth/google`}
        className="mt-6 inline-block rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
      >
        Sign in with Google
      </a>
    </main>
  )
}

export default SignIn
