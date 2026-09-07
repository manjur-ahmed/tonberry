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

export async function createChat(toolSlug: string, message: string): Promise<ChatResult> {
  const response = await authedFetch(`/tools/${toolSlug}/chats`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
  if (!response.ok) throw new Error(`Failed to create chat: ${response.status}`)
  return response.json()
}

export async function startChatFromItem(itemId: string): Promise<ChatResult> {
  const response = await authedFetch(`/items/${itemId}/start-chat`, { method: 'POST' })
  if (!response.ok) throw new Error(`Failed to start chat: ${response.status}`)
  return response.json()
}

export async function addMessage(chatId: string, content: string): Promise<ChatResult> {
  const response = await authedFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
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
