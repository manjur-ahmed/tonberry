import { API_URL, getToken } from './api'

export interface Item {
  id: string
  toolSlug: string
  chatId: string | null
  title: string
  data: unknown
  dedupKey: string | null
  createdAt: string
  updatedAt: string
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  })
}

// Upsert, not a plain create — passing a dedupKey that matches an existing
// item (same tool, same user) updates it in place instead of duplicating it.
// Omit dedupKey for tools with no natural "same thing" concept.
export async function saveItem(
  toolSlug: string,
  chatId: string | null,
  title: string,
  data: unknown,
  dedupKey?: string,
): Promise<Item> {
  const response = await authedFetch('/items', {
    method: 'POST',
    body: JSON.stringify({ toolSlug, chatId, title, data, dedupKey }),
  })
  if (!response.ok) throw new Error(`Failed to save item: ${response.status}`)
  return response.json()
}

export async function getItemsForTool(toolSlug: string): Promise<Item[]> {
  const response = await authedFetch(`/tools/${toolSlug}/items`)
  if (!response.ok) throw new Error(`Failed to load items: ${response.status}`)
  return response.json()
}

export async function getAllItems(): Promise<Item[]> {
  const response = await authedFetch('/items')
  if (!response.ok) throw new Error(`Failed to load items: ${response.status}`)
  return response.json()
}

export async function deleteItem(id: string): Promise<void> {
  const response = await authedFetch(`/items/${id}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`Failed to delete item: ${response.status}`)
}
