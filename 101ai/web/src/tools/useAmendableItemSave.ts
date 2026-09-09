import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { saveItem, ItemLimitReachedError } from '../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../lib/savedMessageItems'
import type { SaveStatus } from './responseViews'

// Shared by every tool whose saved item is one evolving artifact that gets
// *amended* in place rather than accumulating (Cooking's dishKey, Diet's
// planKey, and any future tool with the same shape) — dedupKey is
// chatId+key rather than the artifact's own display name, since that name
// can change on amendment (a "Chicken Pie" gaining mushrooms becomes a
// "Chicken Mushroom Pie") and keying on it would fork a new item every time
// instead of updating the existing one. `key` is expected to be a short,
// stable id the model itself assigns and keeps reusing for the same
// artifact (see each tool's tool-config.ts task for the exact instruction)
// — chatId on top of it is what stops a *different* chat's same key (e.g.
// "chicken-pie" started fresh in a new conversation) from colliding with
// this one.
//
// `item` is null when there's nothing to save yet (a chat-only reply, or
// content that didn't parse) — the effect below just no-ops in that case.
export function useAmendableItemSave(params: {
  toolSlug: string
  chatId: string
  messageId: string
  readOnly?: boolean
  onSaveStatusChange?: (status: SaveStatus) => void
  item: { key: string; title: string; data: unknown } | null
}): void {
  const { toolSlug, chatId, messageId, readOnly, onSaveStatusChange, item } = params

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!item) throw new Error('Nothing to save')
      const request = saveItem(toolSlug, chatId, item.title, item.data, `${chatId}:${item.key}`)
      // This resolves near-instantly today, but the spinner should still
      // read as a spinner rather than flash by — holds it open at least
      // this long regardless of how fast (or slow, once real) the save is.
      return withMinDuration(request, MIN_SAVE_SPINNER_MS)
    },
    onMutate: () => onSaveStatusChange?.('saving'),
    onSuccess: () => {
      markItemSavedForMessage(messageId)
      onSaveStatusChange?.('saved')
    },
    onError: (error) => {
      onSaveStatusChange?.(error instanceof ItemLimitReachedError ? 'limit-reached' : 'error')
    },
  })

  // Every amendable reply is worth saving, so it happens automatically
  // rather than waiting on a user click. Runs once per message instance
  // (component is freshly mounted per message.id) — the ref guard is only
  // to dodge StrictMode's dev-mode double-invoke; the dedup key already
  // makes a genuine double-call harmless either way.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose item already saved successfully skips straight to
  // "saved" instead of re-running the save (and, if the item limit's since
  // been hit, flashing an error on something that's already safely stored).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (!item || readOnly) return
    if (hasSavedItemForMessage(messageId)) {
      onSaveStatusChange?.('saved')
      return
    }
    if (hasSavedRef.current) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
