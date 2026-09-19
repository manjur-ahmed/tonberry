import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { triggerDebugError, type DebugTestType } from '../lib/api'

interface TestDef {
  key: string
  label: string
  description: string
  verify: string
  run: () => void
}

function TestCard({ test, result }: { test: TestDef; result: string | undefined }) {
  return (
    <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{test.label}</p>
          <p className="mt-0.5 text-sm text-slate-600">{test.description}</p>
          <p className="mt-1 text-xs text-slate-400">Verify in: {test.verify}</p>
        </div>
        <button
          type="button"
          onClick={test.run}
          className="flex-shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Trigger
        </button>
      </div>
      {result && <p className="mt-1 text-xs text-slate-500">{result}</p>}
    </div>
  )
}

// Deliberately admin-only, unlinked from nav — reach it by URL, same
// pattern as AdminUsage.tsx. The email check that actually matters lives
// entirely server-side (AdminGuard on the backend calls this page makes);
// a 403 from those just means "not authorized", nothing here grants access
// on its own. Every trigger below is "[TEST]"-prefixed on the backend/in
// its own error text, so it's unmistakable in CloudWatch/Grafana that this
// was deliberate, not a real incident — safe to click as often as needed.
function AdminDebug() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const [results, setResults] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isLoading && !user) navigate('/sign-in', { replace: true })
  }, [user, isLoading, navigate])

  function setResult(key: string, value: string) {
    setResults((prev) => ({ ...prev, [key]: value }))
  }

  async function runBackend(key: string, type: DebugTestType) {
    setResult(key, 'Triggering…')
    try {
      const { status } = await triggerDebugError(type)
      setResult(key, `Backend responded ${status} — check CloudWatch/Grafana now`)
    } catch (error) {
      // A network-level failure (not a 4xx/5xx, which triggerDebugError
      // reports normally) — the request never reached/returned from the API.
      setResult(key, `Request failed to complete: ${(error as Error).message}`)
    }
  }

  const frontendTests: TestDef[] = [
    {
      key: 'throw',
      label: 'Throw uncaught error',
      description: "A real uncaught exception, outside React's render cycle.",
      verify: 'Faro → Frontend → Errors',
      run: () => {
        setResult('throw', 'Thrown — check Faro now')
        setTimeout(() => {
          throw new Error('[TEST] Deliberate uncaught error for observability verification')
        }, 0)
      },
    },
    {
      key: 'console',
      label: 'console.error',
      description: 'A plain console.error call — Faro auto-captures console output.',
      verify: 'Faro → Frontend → Errors (or Logs)',
      run: () => {
        // eslint-disable-next-line no-console
        console.error('[TEST] Deliberate console.error for observability verification')
        setResult('console', 'Logged — check Faro now')
      },
    },
    {
      key: 'reject',
      label: 'Unhandled promise rejection',
      description: 'A rejected promise with nothing to catch it — a different capture path than a thrown error.',
      verify: 'Faro → Frontend → Errors',
      run: () => {
        setResult('reject', 'Rejected — check Faro now')
        Promise.reject(new Error('[TEST] Deliberate unhandled rejection for observability verification'))
      },
    },
  ]

  const backendTests: TestDef[] = [
    {
      key: 'http500',
      label: 'Backend 500',
      description: 'Uncaught error inside a route handler → a real HTTP 500 response.',
      verify: 'CloudWatch apigw_5xx alarm + structured logs',
      run: () => void runBackend('http500', 'http500'),
    },
    {
      key: 'slow',
      label: 'Backend slow (13s)',
      description: 'Deliberately delays 13s — above the 12s alarm threshold, safely under the 15s Lambda timeout.',
      verify: 'CloudWatch lambda_duration alarm',
      run: () => void runBackend('slow', 'slow'),
    },
    {
      key: 'notfound',
      label: 'Backend 404',
      description: 'A normal NotFoundException — confirms 4xx responses log/report correctly too.',
      verify: 'CloudWatch structured logs',
      run: () => void runBackend('notfound', 'notfound'),
    },
    {
      key: 'log',
      label: 'Backend log only',
      description: 'An error-level log line with no actual failure — no alarm should fire from this one.',
      verify: 'CloudWatch structured logs only',
      run: () => void runBackend('log', 'log'),
    },
  ]

  if (!user) return null

  return (
    <main className="flex flex-col gap-6 p-4 pb-24">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Observability test triggers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Deliberately causes real errors so we can confirm CloudWatch, Grafana, and Faro actually pick them up.
          Every trigger is clearly labelled &ldquo;[TEST]&rdquo; wherever it shows up — safe to click.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frontend (Faro)</h2>
        {frontendTests.map((test) => (
          <TestCard key={test.key} test={test} result={results[test.key]} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Backend (CloudWatch)</h2>
        {backendTests.map((test) => (
          <TestCard key={test.key} test={test} result={results[test.key]} />
        ))}
      </section>
    </main>
  )
}

export default AdminDebug
