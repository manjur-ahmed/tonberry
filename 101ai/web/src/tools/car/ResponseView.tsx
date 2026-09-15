import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import YoutubeEmbed from '../../components/YoutubeEmbed'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { fetchYoutubeVideo, type YoutubeVideo } from '../../lib/youtube'
import { getResolvedVideoForGuide, markVideoResolvedForGuide } from '../../lib/resolvedGuideVideos'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import { buildGuideCopyText } from '../../lib/copyText'
import type { ResponseViewProps } from '../responseViews'

interface CarGuide {
  // Stable per-problem id assigned by the model (see tool-config.ts) — same
  // mechanism as cooking's dishKey/diet's planKey. Reused across every
  // reply about the same problem as it gets refined with what the user
  // tried and what happened, only changing when they bring up a genuinely
  // different, unrelated problem. Combined with chatId for the actual
  // dedup key, so two different problems in one chat don't collapse into a
  // single item.
  guideKey: string
  guideTitle: string
  steps: string[]
  videoKeywords: string | null
  // Only present once a saved item is reopened (see ItemDetailModal) — the
  // real video resolved and saved the first time this guideKey was
  // searched (see resolvedGuideVideos.ts). Never present on a live turn's
  // own JSON straight from the model.
  video?: YoutubeVideo
}

// `kind: 'chat'` replies (greetings, small talk, needing more detail
// first, or the model declining to give hands-on steps for a job that
// needs a qualified mechanic — see tool-config.ts) carry the same envelope
// with the rest null and the reply text in `reply` instead; only a 'guide'
// reply renders as a guide or gets auto-saved.
function isCarGuide(value: unknown): value is CarGuide {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return typeof data.guideKey === 'string' && typeof data.guideTitle === 'string' && Array.isArray(data.steps)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function CarResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange, onCopyTextChange }: ResponseViewProps) {
  let data: CarGuide | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isCarGuide(parsed)) data = parsed
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  // Real video resolution, capped at one real YouTube search per distinct
  // guideKey per browser (see resolvedGuideVideos.ts) — a guide gets
  // refined over many replies as the user reports back what happened, but
  // should only ever need one search, not one per reply. `undefined` means
  // "not resolved yet" (still loading or not yet searched); `null` means
  // "searched, genuinely nothing found". A reopened saved item already
  // carries its final video (if any) straight in `data.video`, so it never
  // re-searches.
  const [resolvedVideo, setResolvedVideo] = useState<YoutubeVideo | null | undefined>(() => {
    if (!data) return undefined
    if (readOnly) return data.video ?? null
    return getResolvedVideoForGuide(chatId, data.guideKey)
  })

  useEffect(() => {
    if (!data || readOnly) return
    if (resolvedVideo !== undefined) return
    let cancelled = false
    fetchYoutubeVideo(data.videoKeywords ?? data.guideTitle).then((result) => {
      if (cancelled) return
      markVideoResolvedForGuide(chatId, data!.guideKey, result)
      setResolvedVideo(result)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.guideKey, readOnly])

  const videoReady = !data || readOnly || resolvedVideo !== undefined

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // Dedup key is chatId + guideKey, not the guide title — see cooking's
      // ResponseView for why (a title can change as the guide gets
      // amended, guideKey is what stays stable across that). Carries the
      // resolved video forward into every save of this guideKey, so a
      // later refinement reply's save doesn't drop the video the first
      // reply already found.
      const request = saveItem(
        toolSlug,
        chatId,
        data.guideTitle,
        { ...data, video: resolvedVideo ?? undefined },
        `${chatId}:${data.guideKey}`,
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

  // Every guide reply is worth saving, so it happens automatically rather
  // than waiting on a user click. Runs once per message instance (component
  // is freshly mounted per message.id) — the ref guard is only to dodge
  // StrictMode's dev-mode double-invoke; the dedup key already makes a
  // genuine double-call harmless either way. Waits on videoReady so the
  // save carries the real resolved video rather than racing the search.
  //
  // Reopening a chat remounts this for every historical message too, so a
  // message whose item already saved successfully skips straight to
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
    if (!videoReady) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoReady])

  // Reports the plain-text version up to Chat.tsx so its copy button copies
  // the guide, not this message's raw JSON (see
  // ResponseViewProps.onCopyTextChange).
  useEffect(() => {
    if (data) onCopyTextChange?.(buildGuideCopyText(data.guideTitle, data.steps))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-slate-900">{data.guideTitle}</h2>
      <ol className="mt-4 space-y-2">
        {data.steps.map((step, index) => (
          <li key={index} className="flex gap-2 text-sm text-slate-700">
            <span className="flex-shrink-0 font-semibold text-slate-400">{index + 1}.</span>
            {step}
          </li>
        ))}
      </ol>
      {resolvedVideo && <YoutubeEmbed video={resolvedVideo} />}
    </div>
  )
}

export default CarResponse
