import { API_URL, getToken } from './api'

export interface Suggestion {
  id: string
  userId: string
  userEmail: string
  content: string
  createdAt: string
}

export async function submitSuggestion(content: string): Promise<Suggestion> {
  const token = getToken()
  const response = await fetch(`${API_URL}/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  })
  if (!response.ok) throw new Error(`Failed to submit suggestion: ${response.status}`)
  return response.json()
}

// 403s for any logged-in user other than the one AdminGuard allows — the
// page calling this treats that as "not authorized", not an error (see
// getUsageSummary's identical pattern).
export async function getSuggestions(): Promise<Suggestion[]> {
  const token = getToken()
  const response = await fetch(`${API_URL}/suggestions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Failed to load suggestions: ${response.status}`)
  return response.json()
}
