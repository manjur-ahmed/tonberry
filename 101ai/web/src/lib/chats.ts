import { API_URL, getToken } from './api'
import type { UploadedAttachment } from './uploads'

export type MessageRole = 'user' | 'assistant'

// `url` is always present once a message comes back from the API — the
// backend resolves a fresh presigned view url from the stored key on every
// read (see ChatsService.resolveMessageAttachments), never storing one.
export interface MessageAttachment {
  key: string
  contentType: string
  filename: string
  url: string
}

// A snapshot of a saved Item (title/data as they were at send time, not a
// live reference — see the backend's AttachedItem for why) attached
// alongside an ordinary user message. Distinct from isItemCard below,
// which is for a message that IS an item card on its own with no user
// text (see "Start a chat about this").
export interface AttachedItem {
  itemId: string
  toolSlug: string
  title: string
  data: unknown
}

// The browser's geolocation result, for Steps Planner only (see
// StepsPlannerService) — sent alongside a message the same way an
// attachment or item id already is.
export interface GpsLocation {
  lat: number
  lng: number
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  // Image(s) sent with this message — only ever set on a user message.
  attachments: MessageAttachment[] | null
  // Saved item(s) sent alongside this message — only ever set on a user
  // message, and only when picked via the attach menu's "Items" option.
  attachedItems: AttachedItem[] | null
  // A real walking route computed for this specific Steps Planner reply —
  // set directly from Google's Routes API response server-side, never
  // estimated by the model. Only ever set on an assistant message, and
  // only for the Steps Planner tool; null on any reply that couldn't find
  // a route (a clarifying question, or a real API failure). See
  // steps-planner/ResponseView.tsx.
  routeDistanceMeters: number | null
  routeDurationSeconds: number | null
  routeEncodedPolyline: string | null
  routeStartLabel: string | null
  routeDestinationLabel: string | null
  // Shared by every message in the same "tweak this route" thread (see
  // StepsPlannerService.planRoute's continuation handling) — used as the
  // saved Item's dedupKey instead of this message's own id, so tweaking a
  // route updates one item rather than creating a new one per message.
  // Null for a route's own first message (its own id is the thread) or a
  // non-route reply.
  routeThreadId: string | null
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

// attachments are the {key, contentType, filename} already returned by
// lib/uploads.ts's uploadAttachment — the file itself is long since sitting
// in S3/MinIO by the time this is called, this just tells the backend
// which key(s) belong to this message.
export async function createChat(
  toolSlug: string,
  message: string,
  skipRouter?: boolean,
  attachments?: UploadedAttachment[],
  itemIds?: string[],
  gpsLocation?: GpsLocation,
): Promise<ChatResult> {
  const response = await authedFetch(`/tools/${toolSlug}/chats`, {
    method: 'POST',
    body: JSON.stringify({ message, skipRouter, attachments, itemIds, gpsLocation }),
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

export async function addMessage(
  chatId: string,
  content: string,
  skipRouter?: boolean,
  attachments?: UploadedAttachment[],
  itemIds?: string[],
  gpsLocation?: GpsLocation,
): Promise<ChatResult> {
  const response = await authedFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, skipRouter, attachments, itemIds, gpsLocation }),
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
