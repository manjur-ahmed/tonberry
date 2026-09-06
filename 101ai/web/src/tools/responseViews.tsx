import type { ComponentType } from 'react'
import DefaultResponse from './default/ResponseView'
import WordHelperResponse from './word-helper/ResponseView'

export interface ResponseViewProps {
  content: string
  toolSlug: string
  chatId: string
  // Set when rendering an already-saved item for viewing only — tools that
  // auto-save on mount (see word-helper) should skip that side effect here.
  readOnly?: boolean
}

// Slug -> custom renderer for that tool's AI replies. Anything not listed
// here falls back to DefaultResponse (plain text).
const responseViews: Record<string, ComponentType<ResponseViewProps>> = {
  'word-helper': WordHelperResponse,
}

export function getResponseView(slug: string): ComponentType<ResponseViewProps> {
  return responseViews[slug] ?? DefaultResponse
}
