import { API_URL, getToken } from './api'

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  // True only for the item card a chat started via "Start a chat about
  // this" is seeded with — Chat.tsx renders that one as a compact item
  // card instead of the tool's normal (long) ResponseView.
  isItemCard: boolean
  // The saved item's own title, only set on an isItemCard message — see
  // Message.itemTitle on the backend for why this can't be derived from
  // `content` (the raw item data) instead. Null on a message saved before
  // this field existed.
  itemTitle: string | null
  // The item's own tool — not necessarily this chat's toolSlug, since an
  // item can be opened in a *different* tool's chat (see ItemDetailModal's
  // "Open in another tool"). Chat.tsx uses this to pick the item's own
  // ItemView so it still renders correctly (e.g. a film item keeps its
  // title+year card) even inside a chat that belongs to a different tool.
  // Null on a message saved before this field existed.
  itemToolSlug: string | null
  createdAt: string
}

export interface Chat {
  id: string
  toolSlug: string
  title: string
  lastMessagePreview: string | null
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export type ChatResult = { type: 'redirect'; suggestedTool: string } | { type: 'reply'; chat: Chat }

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      // Only set when there's a body — Fastify tries to JSON-parse the
      // body whenever this header is present (except on GET/HEAD), and
      // rejects an empty body with a 400 on a bodyless call.
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  })
}

export async function createChat(toolSlug: string, message: string, skipRouter?: boolean): Promise<ChatResult> {
  const response = await authedFetch(`/tools/${toolSlug}/chats`, {
    method: 'POST',
    body: JSON.stringify({ message, skipRouter }),
  })
  if (!response.ok) throw new Error(`Failed to create chat: ${response.status}`)
  return response.json()
}

// Omit targetToolSlug to start the chat in the item's own tool (the
// default) — pass it to send the item to a different tool instead (see
// ItemDetailModal's "Open in another tool").
export async function startChatFromItem(itemId: string, targetToolSlug?: string): Promise<ChatResult> {
  const response = await authedFetch(`/items/${itemId}/start-chat`, {
    method: 'POST',
    body: JSON.stringify({ targetToolSlug }),
  })
  if (!response.ok) throw new Error(`Failed to start chat: ${response.status}`)
  return response.json()
}

export async function addMessage(chatId: string, content: string, skipRouter?: boolean): Promise<ChatResult> {
  const response = await authedFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, skipRouter }),
  })
  if (!response.ok) throw new Error(`Failed to send message: ${response.status}`)
  return response.json()
}

export async function getChat(chatId: string): Promise<Chat> {
  const response = await authedFetch(`/chats/${chatId}`)
  if (!response.ok) throw new Error(`Failed to load chat: ${response.status}`)
  return response.json()
}

export async function getChatsForTool(toolSlug: string): Promise<Chat[]> {
  const response = await authedFetch(`/tools/${toolSlug}/chats`)
  if (!response.ok) throw new Error(`Failed to load chats: ${response.status}`)
  return response.json()
}

export async function getAllChats(): Promise<Chat[]> {
  const response = await authedFetch(`/chats`)
  if (!response.ok) throw new Error(`Failed to load chats: ${response.status}`)
  return response.json()
}
