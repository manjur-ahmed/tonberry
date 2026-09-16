// MS Clarity session analytics. Gated on the actual hostname, not just
// import.meta.env.PROD/VITE_CLARITY_PROJECT_ID being set — a prod *build*
// run locally (`vite preview`) or a preview deploy on some other domain
// still has PROD=true and the env var baked in, but must never report real
// session data as if it were the live app. Checking window.location.hostname
// directly is the only gate that actually guarantees local/non-prod browsing
// never reaches Clarity.
const PROD_HOSTNAME = '101ai.tonberry.co.uk'

// Clarity's own queue-based stub — same shape as their official embed
// snippet, just typed. Anything calling `window.clarity(...)` before the
// real script has loaded gets queued in `.q` and flushed once it has.
interface ClarityStub {
  (...args: unknown[]): void
  q?: unknown[][]
}

declare global {
  interface Window {
    clarity?: ClarityStub
  }
}

export function initAnalytics(): void {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID
  if (!projectId) return
  if (window.location.hostname !== PROD_HOSTNAME) return

  const clarityStub: ClarityStub = (...args: unknown[]) => {
    ;(clarityStub.q = clarityStub.q || []).push(args)
  }
  window.clarity = clarityStub

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${projectId}`
  const firstScript = document.getElementsByTagName('script')[0]
  firstScript.parentNode?.insertBefore(script, firstScript)
}
