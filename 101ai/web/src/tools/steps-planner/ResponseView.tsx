import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import RouteMap from './RouteMap'
import type { ResponseViewProps } from '../responseViews'

export interface SavedRouteData {
  distanceMeters: number | null
  durationSeconds: number | null
  encodedPolyline: string | null
  startLabel: string | null
  destinationLabel: string | null
}

function isSavedRouteData(value: unknown): value is SavedRouteData {
  if (!value || typeof value !== 'object') return false
  return 'encodedPolyline' in value
}

function routeTitle(startLabel: string | null, destinationLabel: string | null): string {
  if (!startLabel) return 'Walking route'
  return destinationLabel && destinationLabel !== startLabel
    ? `${startLabel} → ${destinationLabel}`
    : `Loop from ${startLabel}`
}

// Each individual route search saves as its OWN item, keyed by this
// message — same "one item per real result, not merged into a running
// document" fix already applied to News. Real distance/duration/polyline
// come from Google's actual computed route (see ChatsService/
// StepsPlannerService) — this component never invents or estimates them,
// only renders and saves what was already computed server-side.
//
// Two ways this renders: a live reply, where Chat.tsx passes the route
// fields as real props and `content` is the deterministic reply text
// (see StepsPlannerService); or a saved item being reopened read-only,
// where ItemDetailModal instead passes `content` as the raw JSON of the
// saved SavedRouteData (no route props at all) — detected by
// routeEncodedPolyline being undefined rather than merely null.
function StepsPlannerResponse({
  content,
  toolSlug,
  chatId,
  messageId,
  readOnly,
  routeDistanceMeters,
  routeDurationSeconds,
  routeEncodedPolyline,
  routeStartLabel,
  routeDestinationLabel,
  routeThreadId,
  onSaveStatusChange,
}: ResponseViewProps) {
  const isSavedItemView = routeEncodedPolyline === undefined

  let saved: SavedRouteData | null = null
  if (isSavedItemView) {
    try {
      const parsed: unknown = JSON.parse(content)
      if (isSavedRouteData(parsed)) saved = parsed
    } catch {
      // Not JSON — falls through to the plain-text render below.
    }
  }
  const encodedPolyline = isSavedItemView ? (saved?.encodedPolyline ?? null) : (routeEncodedPolyline ?? null)
  const startLabel = isSavedItemView ? (saved?.startLabel ?? null) : (routeStartLabel ?? null)
  const destinationLabel = isSavedItemView ? (saved?.destinationLabel ?? null) : (routeDestinationLabel ?? null)

  const saveMutation = useMutation({
    mutationFn: () => {
      const data: SavedRouteData = {
        distanceMeters: routeDistanceMeters ?? null,
        durationSeconds: routeDurationSeconds ?? null,
        encodedPolyline: routeEncodedPolyline ?? null,
        startLabel: routeStartLabel ?? null,
        destinationLabel: routeDestinationLabel ?? null,
      }
      // A route thread (see StepsPlannerService's continuation handling)
      // shares one dedupKey across every "tweak this route" message, so
      // saveItem's upsert updates the same Item rather than creating a
      // new one each time the user adjusts distance/mode — only a
      // genuinely new route (no routeThreadId, or one that starts a new
      // thread) gets its own item, keyed by its own message id as before.
      const request = saveItem(
        toolSlug,
        chatId,
        routeTitle(routeStartLabel ?? null, routeDestinationLabel ?? null),
        data,
        routeThreadId ?? messageId,
      )
      // Resolves near-instantly today, but the spinner should still read as
      // a spinner rather than flash by — holds it open at least this long
      // regardless of how fast (or slow, once real) the save is.
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

  // Auto-saves once per live reply that actually found a route — same ref
  // guard against StrictMode's dev-mode double-invoke as every other
  // auto-saving ResponseView (see e.g. news/ResponseView.tsx).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (isSavedItemView || !routeEncodedPolyline || readOnly) return
    if (hasSavedItemForMessage(messageId)) {
      onSaveStatusChange?.('saved')
      return
    }
    if (hasSavedRef.current) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <p className="whitespace-pre-line text-sm text-slate-700">{content}</p>
      {encodedPolyline && (
        <div className="mt-3">
          <RouteMap encodedPolyline={encodedPolyline} startLabel={startLabel} destinationLabel={destinationLabel} />
        </div>
      )}
    </div>
  )
}

export default StepsPlannerResponse
