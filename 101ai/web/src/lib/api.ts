export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

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
  plan: 'free' | 'plus' | 'premium' | null
  country: string | null
  darkTheme: boolean
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

export async function setPlan(plan: 'free' | 'plus' | 'premium'): Promise<CurrentUser> {
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

export interface Preferences {
  name: string
  otherNames?: string
  country: string
  darkTheme: boolean
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
