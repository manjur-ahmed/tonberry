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
  plan: 'free' | 'plus' | 'premium' | null
  country: string | null
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

export async function setCountry(country: string): Promise<CurrentUser> {
  const token = getToken()
  const response = await fetch(`${API_URL}/users/country`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ country }),
  })
  if (!response.ok) throw new Error(`Failed to set country: ${response.status}`)
  return response.json()
}
