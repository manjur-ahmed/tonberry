import { API_URL, getToken } from './api'

// Kept in sync with the backend's ALLOWED_UPLOAD_CONTENT_TYPES (see
// 101ai/api/src/uploads/dto/presign-upload.dto.ts) — checked client-side
// too so a bad file is rejected before ever hitting the network. Only the
// image/* entries ever reach OpenAI as vision content (see
// ChatsService.resolveAttachmentsForVision) — a document is stored and
// shown like any attachment, but the model only learns its filename.
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

// The Files picker's `accept` attribute — file extensions read better than
// raw mime types in a native OS picker, and cover the same set as
// ALLOWED_UPLOAD_CONTENT_TYPES above. Camera/Photos keep their own
// `accept="image/*"` since those are specifically for photos.
export const ALLOWED_UPLOAD_FILE_EXTENSIONS = '.jpg,.jpeg,.png,.webp,.heic,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx'

// Kept in sync with the backend's MAX_UPLOAD_SIZE_BYTES (same file) — this
// copy is just what lets a caller reject an oversized file instantly,
// before wasting a request on it. The backend's copy is what's actually
// enforced (see UploadsService.createUploadUrl's ContentLength binding);
// this one being out of sync would only mean a slightly wrong client-side
// message, never a way to bypass the real limit.
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

export interface UploadedAttachment {
  key: string
  contentType: string
  filename: string
}

// Two-step upload: this asks the backend for a presigned S3/MinIO PUT url
// (see UploadsController), then PUTs the file bytes straight to that url —
// the file never passes through this app's own API, avoiding Lambda's
// payload-size limits entirely in prod.
export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  const response = await fetch(`${API_URL}/uploads/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
  })
  if (!response.ok) throw new Error(`Failed to get upload url: ${response.status}`)
  const { key, uploadUrl } = await response.json()

  // The browser sets Content-Length itself from the body's real byte
  // length (fetch doesn't allow overriding it) — always exactly file.size,
  // which is what the presigned url above was bound to, so this either
  // matches or the PUT below fails cleanly.
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!putResponse.ok) throw new Error(`Failed to upload file: ${putResponse.status}`)

  return { key, contentType: file.type, filename: file.name }
}
