// Falls back to whatever host the page itself was loaded from (with the
// API's port) rather than a hardcoded 'localhost' — that way the same dev
// build works correctly whether you open it as localhost or over a LAN IP
// (e.g. testing from a phone), with no manual syncing when the LAN IP
// changes (DHCP renewal, reconnecting to Wi-Fi, etc). VITE_API_URL still
// wins if explicitly set (e.g. prod's real api.* domain).
export const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3001`

const TOKEN_KEY = '101ai_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export interface CurrentUser {
  id: string
  email: string
  name: string | null
  otherNames: string | null
  plan: 'basic' | 'plus' | 'premium' | null
  country: string | null
  darkTheme: boolean
  dateOfBirth: string | null
  // Set once the user taps "Continue with free trial" on /pricing — see
  // the backend User entity's comment. Still null for a user who instead
  // picked a real plan directly, or hasn't done either yet.
  trialStartedAt: string | null
  hasPassword: boolean
}

// Reads the backend's { message } body on failure (class-validator's
// ValidationPipe and thrown HttpExceptions both shape errors this way) so
// callers can show the actual reason — "Invalid email or password",
// "Current password is incorrect" — rather than a bare status code.
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null)
  const message = body?.message
  if (typeof message === 'string') return message
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
  return fallback
}

export async function fetchMe(): Promise<CurrentUser | null> {
  const token = getToken()
  if (!token) return null

  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 401) {
    clearToken()
    return null
  }
  if (!response.ok) throw new Error(`Failed to load current user: ${response.status}`)
  return response.json()
}

export async function setPlan(plan: 'basic' | 'plus' | 'premium'): Promise<CurrentUser> {
  const token = getToken()
  const response = await fetch(`${API_URL}/users/plan`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  })
  if (!response.ok) throw new Error(`Failed to set plan: ${response.status}`)
  return response.json()
}

export async function startTrial(): Promise<CurrentUser> {
  const token = getToken()
  const response = await fetch(`${API_URL}/users/trial`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Failed to start trial: ${response.status}`)
  return response.json()
}

// All optional — see the backend's SetPreferencesDto/setPreferences for
// why: each onboarding step (Country, Location, Theme) PATCHes only the
// field(s) it actually collects, not the whole set every time.
export interface Preferences {
  name?: string
  otherNames?: string
  country?: string
  darkTheme?: boolean
  dateOfBirth?: string
}

export async function setPreferences(preferences: Preferences): Promise<CurrentUser> {
  const token = getToken()
  const response = await fetch(`${API_URL}/users/preferences`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(preferences),
  })
  if (!response.ok) throw new Error(`Failed to set preferences: ${response.status}`)
  return response.json()
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(await readErrorMessage(response, 'Could not sign in — try again.'))
  return response.json()
}

export async function register(name: string, email: string, password: string): Promise<{ token: string }> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  })
  if (!response.ok) throw new Error(await readErrorMessage(response, 'Could not create account — try again.'))
  return response.json()
}

export async function deleteAccount(): Promise<void> {
  const token = getToken()
  const response = await fetch(`${API_URL}/users/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(await readErrorMessage(response, 'Could not delete account — try again.'))
}

export async function setPassword(newPassword: string): Promise<CurrentUser> {
  const token = getToken()
  const response = await fetch(`${API_URL}/users/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  })
  if (!response.ok) throw new Error(await readErrorMessage(response, 'Could not update password — try again.'))
  return response.json()
}

export type UsageRange = '7d' | '30d' | '90d'

export interface UsageSummary {
  range: UsageRange
  perResponse: { averageCostUsd: number; count: number }
  perChat: { averageCostUsd: number; chatCount: number }
  perUser: { averageCostUsd: number; userCount: number }
  timeSeries: { date: string; totalCostUsd: number; requestCount: number }[]
  byModel: { model: string; totalCostUsd: number; totalTokens: number; requestCount: number }[]
  byPlan: {
    plan: 'basic' | 'plus' | 'premium' | null
    totalCostUsd: number
    avgCostPerResponseUsd: number
    requestCount: number
    userCount: number
  }[]
}

// 403s for any logged-in user other than the one AdminGuard allows — the
// page calling this treats that as "not authorized", not an error.
export async function getUsageSummary(range: UsageRange): Promise<UsageSummary> {
  const token = getToken()
  const response = await fetch(`${API_URL}/admin/usage/summary?range=${range}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Failed to load usage summary: ${response.status}`)
  return response.json()
}

export type BillingCycle = 'monthly' | 'yearly' | 'one_time'

export interface RecurringCost {
  id: string
  name: string
  category: string | null
  amountUsd: string
  billingCycle: BillingCycle
  renewsAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface RecurringCostsSummary {
  costs: RecurringCost[]
  monthlyTotalUsd: number
}

export interface RecurringCostInput {
  name: string
  category?: string | null
  amountUsd: number
  billingCycle: BillingCycle
  renewsAt?: string | null
  notes?: string | null
}

// Admin-only (same AdminGuard as getUsageSummary above) — the manually
// maintained "everything we pay for" ledger behind AdminCosts.tsx.
export async function getRecurringCosts(): Promise<RecurringCostsSummary> {
  const token = getToken()
  const response = await fetch(`${API_URL}/admin/costs`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Failed to load recurring costs: ${response.status}`)
  return response.json()
}

export async function createRecurringCost(input: RecurringCostInput): Promise<RecurringCost> {
  const token = getToken()
  const response = await fetch(`${API_URL}/admin/costs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Failed to create recurring cost: ${response.status}`)
  return response.json()
}

export async function updateRecurringCost(
  id: string,
  input: Partial<RecurringCostInput>,
): Promise<RecurringCost> {
  const token = getToken()
  const response = await fetch(`${API_URL}/admin/costs/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(`Failed to update recurring cost: ${response.status}`)
  return response.json()
}

export async function deleteRecurringCost(id: string): Promise<void> {
  const token = getToken()
  const response = await fetch(`${API_URL}/admin/costs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Failed to delete recurring cost: ${response.status}`)
}

export type DebugTestType = 'http500' | 'slow' | 'notfound' | 'log'

// Admin-only (same AdminGuard as getUsageSummary above), deliberately
// triggers a real failure on the backend to verify the observability
// pipeline (CloudWatch alarms, structured logs, Grafana) actually picks it
// up — see api/src/debug/debug.controller.ts. A non-2xx status here is the
// EXPECTED, successful outcome for http500/notfound (that's the whole
// point), so this reports the status back rather than throwing on !ok —
// the caller decides how to present it, this never a "did it fail" check.
export async function triggerDebugError(type: DebugTestType): Promise<{ status: number }> {
  const token = getToken()
  const response = await fetch(`${API_URL}/debug/test-error?type=${type}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: response.status }
}
