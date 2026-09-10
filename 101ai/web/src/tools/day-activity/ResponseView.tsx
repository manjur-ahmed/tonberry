import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import type { ResponseViewProps } from '../responseViews'

interface Activity {
  title: string
  category: string | null
  duration: string | null
  description: string | null
  whyRecommended: string | null
}

interface ActivityRecommendations {
  activities: Activity[]
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
    <div className="bg-white pt-4">
      <h3 className="font-display text-xl font-bold text-slate-900">{activity.title}</h3>
      {(activity.category || activity.duration) && (
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
          {[activity.category, activity.duration].filter(Boolean).join(' • ')}
        </p>
      )}
      {activity.description && <p className="mt-3 text-sm text-slate-700">{activity.description}</p>}
      {activity.whyRecommended && (
        <div className="mt-3">
          <Label>Why this one</Label>
          <p className="mt-1 text-sm text-slate-700">{activity.whyRecommended}</p>
        </div>
      )}
    </div>
  )
}

function ActivityFinderResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange }: ResponseViewProps) {
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

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // One item per activity, deduped by title — suggesting "Coastal Walk"
      // again in a later chat updates the same saved item rather than
      // piling up duplicates. Promise.all here means one activity hitting
      // the free-plan item limit surfaces as the overall save failing
      // (onError below), even though any activities saved before the limit
      // was hit stay saved.
      const request = Promise.all(
        data.activities.map((activity) => saveItem(toolSlug, chatId, activity.title, activity, activity.title.toLowerCase())),
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
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    // pb-2 on top of MessageActions' own mt-2 (see Chat.tsx) puts more gap
    // before the feedback row than sits between cards (space-y-4) — without
    // it, the last activity's content butts right up against the feedback
    // icons and reads as if they belong to that activity specifically
    // rather than to the whole multi-activity response.
    <div className="space-y-4 pb-2">
      {data.activities.map((activity) => (
        <ActivityCard key={activity.title} activity={activity} />
      ))}
    </div>
  )
}

export default ActivityFinderResponse
