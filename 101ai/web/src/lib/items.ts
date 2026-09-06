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
      // Only set when there's a body — Fastify tries to JSON-parse the
      // body whenever this header is present (except on GET/HEAD), and
      // rejects an empty body with a 400 (e.g. this DELETE call).
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  })
}

// Thrown instead of the generic error below when the save failed because
// the user is on the free plan and already has the max items for this tool
// — lets callers show the upgrade prompt only for this specific reason.
export class ItemLimitReachedError extends Error {
  constructor() {
    super('Item limit reached for this plan')
    this.name = 'ItemLimitReachedError'
  }
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
  if (response.status === 403) {
    const body = await response.json().catch(() => null)
    if (body?.code === 'ITEM_LIMIT_REACHED') throw new ItemLimitReachedError()
  }
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
