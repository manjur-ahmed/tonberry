import {
  initializeFaro,
  getWebInstrumentations,
  ReactIntegration,
  createReactRouterV7DataOptions,
} from '@grafana/faro-react'
import { matchRoutes } from 'react-router-dom'

// Grafana Faro (Frontend Observability) — same hostname-only gate as
// lib/analytics.ts's MS Clarity loader, for the same reason: a prod build
// run locally (`vite preview`) or any non-prod host must never report real
// session data. Unlike Clarity, this also captures unhandled JS errors,
// console output, Web Vitals, and every fetch/XHR call (method/url/status/
// duration) — auto-instrumented via getWebInstrumentations(), no manual
// wiring needed at each call site.
const PROD_HOSTNAME = '101ai.tonberry.co.uk'

export function initFaro(): void {
  const collectorUrl = import.meta.env.VITE_FARO_COLLECTOR_URL
  if (!collectorUrl) return
  if (window.location.hostname !== PROD_HOSTNAME) return

  initializeFaro({
    url: collectorUrl,
    app: {
      name: '101ai',
      version: '1.0.0',
      environment: 'production',
    },
    instrumentations: [
      ...getWebInstrumentations(),
      // Route-change events via React Router's data router API (see
      // router.tsx's createBrowserRouter + withFaroRouterInstrumentation —
      // that wrapper is always applied, but only actually reports anything
      // once this ReactIntegration has run, i.e. only when initFaro()
      // itself ran, i.e. only on the real prod hostname).
      new ReactIntegration({
        router: createReactRouterV7DataOptions({ matchRoutes }),
      }),
    ],
  })
}
