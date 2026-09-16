import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { initAnalytics } from './lib/analytics'
import { initFaro } from './lib/faro'
import './index.css'

// Both no-op outside the real prod domain — see lib/analytics.ts/lib/faro.ts.
initAnalytics()
initFaro()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
