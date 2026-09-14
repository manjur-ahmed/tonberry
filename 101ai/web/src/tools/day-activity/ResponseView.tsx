import { useEffect, useRef } from 'react'
import { useMutation, useQueries } from '@tanstack/react-query'
import { Navigation } from 'lucide-react'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { fetchActivityVenue, googleMapsPlaceUrl, staticMapUrl, type ActivityVenue } from '../../lib/activityPlanner'
import { getCachedGpsLocation } from '../../lib/gpsLocation'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import { buildCardListCopyText } from '../../lib/copyText'
import type { ResponseViewProps } from '../responseViews'

interface Activity {
  title: string
  category: string | null
  duration: string | null
  description: string | null
  suitableFor: string | null
  whyRecommended: string | null
  // A short, plain search phrase for this activity TYPE (e.g. "escape
  // room"), separate from the more flavourful `title` — see
  // tool-config.ts's day-activity entry. Used to resolve a REAL nearby
  // venue (see venue below), never shown to the user directly.
  searchQuery: string | null
  // The real Places result for this activity, once resolved — undefined
  // while still resolving (or for a message saved before this existed),
  // null if no real match was found nearby. Only ever set by this app,
  // never the model.
  venue?: ActivityVenue | null
}

interface ActivityRecommendations {
  activities: Activity[]
}

// Once a real venue's resolved, its own name is the title — the model's
// `title` was only ever a placeholder idea for the "still searching" state
// or the rare case no real match turned up nearby.
function displayTitle(activity: Activity): string {
  return activity.venue?.displayName ?? activity.title
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with `activities` empty and
// the reply text in `reply` instead; only a 'recommendations' reply with at
// least one activity renders as a list or gets auto-saved.
function isActivityRecommendations(value: unknown): value is ActivityRecommendations {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return Array.isArray(data.activities) && data.activities.length > 0
}

// A saved item's `data` is a single Activity (see saveMutation below — one
// item per activity, not the whole {activities: [...]} reply envelope), so
// ItemDetailModal feeding item.data back through this same ResponseView
// needs its own check rather than isActivityRecommendations.
function isSingleActivity(value: unknown): value is Activity {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && !('activities' in data) && !('kind' in data)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {activity.venue && (
        <img
          src={staticMapUrl(activity.venue.lat, activity.venue.lng)}
          alt=""
          className="aspect-[3/2] w-full object-cover"
        />
      )}
      <div className="p-4">
        <h3 className="font-display text-xl font-bold text-slate-900">{displayTitle(activity)}</h3>
        {(activity.category || activity.duration) && (
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {[activity.category, activity.duration].filter(Boolean).join(' • ')}
          </p>
        )}
        {activity.description && <p className="mt-3 text-sm text-slate-700">{activity.description}</p>}
        {activity.suitableFor && (
          <div className="mt-3">
            <Label>Suitable for</Label>
            <p className="mt-1 text-sm text-slate-700">{activity.suitableFor}</p>
          </div>
        )}
        {activity.whyRecommended && (
          <div className="mt-3">
            <Label>Why this one</Label>
            <p className="mt-1 text-sm text-slate-700">{activity.whyRecommended}</p>
          </div>
        )}
        {activity.venue && (
          <a
            href={googleMapsPlaceUrl(activity.venue)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            <Navigation className="h-4 w-4" strokeWidth={2} />
            Open in Google Maps
          </a>
        )}
      </div>
    </div>
  )
}

function buildActivityCopyText(activity: Activity): string {
  return [
    displayTitle(activity),
    [activity.category, activity.duration].filter(Boolean).join(' • ') || null,
    activity.description,
    activity.suitableFor ? `Suitable for: ${activity.suitableFor}` : null,
    activity.whyRecommended ? `Why this one: ${activity.whyRecommended}` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n')
}

function ActivityFinderResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange, onCopyTextChange }: ResponseViewProps) {
  let data: ActivityRecommendations | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isActivityRecommendations(parsed)) data = parsed
    else if (isSingleActivity(parsed)) data = { activities: [parsed] }
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  // Resolves a REAL nearby venue per activity (see lib/activityPlanner.ts)
  // — only for a live, freshly-generated list, never a saved item being
  // reopened (that already has its venue, if any, baked into its own
  // `data`) and never a readOnly view. gpsLocation is read straight from
  // the shared cache (see lib/gpsLocation.ts) rather than threaded through
  // as a prop — this component doesn't need to know how it was obtained.
  const isLiveList = !!data && !readOnly && data.activities.every((activity) => activity.venue === undefined)
  const gps = isLiveList ? getCachedGpsLocation() : null
  const venueQueries = useQueries({
    queries: (data?.activities ?? []).map((activity) => ({
      queryKey: ['activity-venue', activity.searchQuery ?? activity.title, gps?.lat ?? null, gps?.lng ?? null],
      queryFn: () => fetchActivityVenue(activity.searchQuery ?? activity.title, gps?.lat, gps?.lng),
      enabled: isLiveList,
      staleTime: Infinity,
    })),
  })
  const venuesReady = !isLiveList || venueQueries.every((query) => !query.isPending)

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // One item per activity. Deduped by the real venue's placeId once
      // resolved (the true identity of what got saved) rather than the
      // model's own idea title — falls back to the title only when no real
      // venue was found that time. Promise.all here means one activity
      // hitting the free-plan item limit surfaces as the overall save
      // failing (onError below), even though any activities saved before
      // the limit was hit stay saved.
      const request = Promise.all(
        data.activities.map((activity, index) => {
          const withVenue: Activity = {
            ...activity,
            venue: isLiveList ? (venueQueries[index]?.data ?? null) : activity.venue,
          }
          const dedupKey = withVenue.venue?.placeId ?? activity.title.toLowerCase()
          return saveItem(toolSlug, chatId, displayTitle(withVenue), withVenue, dedupKey)
        }),
      )
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

  // Every recommendations reply is worth saving, so it happens
  // automatically rather than waiting on a user click. Runs once per
  // message instance (component is freshly mounted per message.id) — the
  // ref guard is only to dodge StrictMode's dev-mode double-invoke; the
  // dedup key already makes a genuine double-call harmless either way.
  // Waits on venuesReady so each activity saves with its real resolved
  // venue rather than racing the lookups and saving null for all of them.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose items already saved successfully skips straight to
  // "saved" instead of re-running the save (and, if the item limit's since
  // been hit, flashing an error on something that's already safely stored).
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (!data || readOnly) return
    if (hasSavedItemForMessage(messageId)) {
      onSaveStatusChange?.('saved')
      return
    }
    if (hasSavedRef.current) return
    if (!venuesReady) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venuesReady])

  // Reports the plain-text version up to Chat.tsx so its copy button copies
  // the recommendations, not this message's raw JSON (see
  // ResponseViewProps.onCopyTextChange). Waits on venuesReady so a live list
  // copies with resolved venue names rather than the model's placeholder
  // titles.
  useEffect(() => {
    if (!data || !venuesReady) return
    const resolved = data.activities.map((activity, index) =>
      isLiveList ? { ...activity, venue: venueQueries[index]?.data ?? null } : activity,
    )
    onCopyTextChange?.(buildCardListCopyText(resolved.map(buildActivityCopyText)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venuesReady])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    // pb-2 on top of MessageActions' own mt-2 (see Chat.tsx) puts more gap
    // before the feedback row than sits between cards (space-y-4) — without
    // it, the last activity's content butts right up against the feedback
    // icons and reads as if they belong to that activity specifically
    // rather than to the whole multi-activity response.
    <div className="space-y-4 pb-2">
      {data.activities.map((activity, index) => (
        <ActivityCard
          key={activity.title}
          activity={isLiveList ? { ...activity, venue: venueQueries[index]?.data ?? null } : activity}
        />
      ))}
    </div>
  )
}

export default ActivityFinderResponse
