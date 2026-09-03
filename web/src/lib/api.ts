export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function fetchHealth(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${API_URL}/health`)
  if (!response.ok) {
    throw new Error(`API health check failed: ${response.status}`)
  }
  return response.json()
}

export interface CreateLeadInput {
  name: string
  email: string
  propertyType?: string
  loanAmount?: string
}

export async function createLead(input: CreateLeadInput) {
  const response = await fetch(`${API_URL}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message?.[0] ?? `Submission failed: ${response.status}`)
  }
  return response.json()
}
