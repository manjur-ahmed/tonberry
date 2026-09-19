import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import DefaultResponse from '../default/ResponseView'
import YoutubeEmbed from '../../components/YoutubeEmbed'
import { saveItem, ItemLimitReachedError } from '../../lib/items'
import { fetchYoutubeVideo, type YoutubeVideo } from '../../lib/youtube'
import { withMinDuration, MIN_SAVE_SPINNER_MS } from '../../lib/delay'
import { hasSavedItemForMessage, markItemSavedForMessage } from '../../lib/savedMessageItems'
import { formatPlays } from '../../lib/formatPlays'
import { buildCardListCopyText } from '../../lib/copyText'
import type { ResponseViewProps } from '../responseViews'

interface Song {
  title: string
  artist: string | null
  year: string | null
  genre: string | null
  summary: string | null
  whyRecommended: string | null
  spotifyPlays: number | null
  // A short real search phrase, only ever set when the model is confident
  // this is a real, findable song (see tool-config.ts's
  // VIDEO_KEYWORDS_GUIDANCE) — never a URL/video ID itself.
  videoKeywords: string | null
  // Only present once a saved item is reopened (see ItemDetailModal) — the
  // real video resolved and saved the first time this song was searched.
  // Never present on a live turn's own JSON straight from the model.
  video?: YoutubeVideo
}

interface MusicRecommendations {
  songs: Song[]
}

// `kind: 'chat'` replies (greetings, small talk, or a clarifying question —
// see tool-config.ts) carry the same envelope with `songs` empty and the
// reply text in `reply` instead; only a 'recommendations' reply with at
// least one song renders as a list or gets auto-saved. `kind` is missing on
// messages saved before this field existed — treat that as a (legacy)
// recommendations reply too, rather than failing the check and dumping raw
// JSON for old chat history.
function isMusicRecommendations(value: unknown): value is MusicRecommendations {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.kind === 'chat') return false
  return Array.isArray(data.songs) && data.songs.length > 0
}

// A saved item's `data` is a single Song (see saveMutation below — one item
// per song, not the whole {songs: [...]} reply envelope), so ItemDetailModal
// feeding item.data back through this same ResponseView (the way
// word-helper's item shape already matches its response shape) needs its
// own check rather than isMusicRecommendations.
function isSingleSong(value: unknown): value is Song {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.title === 'string' && !('songs' in data) && !('kind' in data)
}

function getChatReply(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  return data.kind === 'chat' && typeof data.reply === 'string' ? data.reply : null
}

function Label({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
}

// Dedup key includes the artist, not just the title — unlike a film, two
// different songs can share the exact same title.
function dedupKey(song: Song): string {
  return `${song.title}::${song.artist ?? ''}`.toLowerCase()
}

function SongCard({ song, video }: { song: Song; video?: YoutubeVideo }) {
  return (
    <div className="bg-white pt-4">
      <h3 className="font-display text-xl font-bold text-slate-900">
        {song.title}
        {song.year && <span className="text-slate-400"> ({song.year})</span>}
      </h3>
      {song.artist && <p className="mt-0.5 text-sm text-slate-500">{song.artist}</p>}
      {song.genre && <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{song.genre}</p>}
      {song.summary && <p className="mt-3 text-sm text-slate-700">{song.summary}</p>}
      {song.whyRecommended && (
        <div className="mt-3">
          <Label>Why this one</Label>
          <p className="mt-1 text-sm text-slate-700">{song.whyRecommended}</p>
        </div>
      )}
      {song.spotifyPlays != null && (
        <div className="mt-3 flex items-center gap-1 text-sm text-slate-700">
          <Play className="h-4 w-4 text-emerald-500" strokeWidth={1.75} fill="currentColor" />
          <span>{formatPlays(song.spotifyPlays)} plays on Spotify</span>
        </div>
      )}
      {video && <YoutubeEmbed video={video} />}
    </div>
  )
}

function buildSongCopyText(song: Song): string {
  return [
    song.year ? `${song.title} (${song.year})` : song.title,
    song.artist,
    song.genre,
    song.summary,
    song.whyRecommended ? `Why this one: ${song.whyRecommended}` : null,
    song.spotifyPlays != null ? `${formatPlays(song.spotifyPlays)} plays on Spotify` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n')
}

function MusicRecommendationsResponse({ content, toolSlug, chatId, messageId, readOnly, onSaveStatusChange, onCopyTextChange }: ResponseViewProps) {
  let data: MusicRecommendations | null = null
  let chatReply: string | null = null
  try {
    const parsed = JSON.parse(content)
    if (isMusicRecommendations(parsed)) data = parsed
    else if (isSingleSong(parsed)) data = { songs: [parsed] }
    else chatReply = getChatReply(parsed)
  } catch {
    data = null
  }

  // One real YouTube search per song, only for songs the model flagged as
  // confidently findable (videoKeywords set — see tool-config.ts). `null`
  // at index i means "no video for this song" — the array itself being
  // non-null is what means "resolved" (see videoReady below). A reopened
  // saved item already carries its final video (if any) straight in
  // `song.video`, so it never re-searches.
  const [videos, setVideos] = useState<(YoutubeVideo | null)[] | null>(() => {
    if (!data) return null
    if (readOnly) return data.songs.map((song) => song.video ?? null)
    return null
  })

  useEffect(() => {
    if (!data || readOnly) return
    let cancelled = false
    Promise.all(
      data.songs.map((song) => (song.videoKeywords ? fetchYoutubeVideo(song.videoKeywords) : Promise.resolve(null))),
    ).then((results) => {
      if (!cancelled) setVideos(results)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const videoReady = !data || readOnly || videos !== null

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!data) throw new Error('Nothing to save')
      // One item per song, deduped by title+artist — recommending
      // "Yesterday" again in a later chat updates the same saved item
      // rather than piling up duplicates. Promise.all here means one song
      // hitting the free-plan item limit surfaces as the overall save
      // failing (onError below), even though any songs saved before the
      // limit was hit stay saved. Carries each song's resolved video (if
      // any) into the saved data.
      const request = Promise.all(
        data.songs.map((song, index) =>
          saveItem(
            toolSlug,
            chatId,
            song.title,
            { ...song, video: videos?.[index] ?? undefined },
            dedupKey(song),
          ),
        ),
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
  // Waits on videoReady so the save carries each song's real resolved
  // video rather than racing the search.
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
    if (!videoReady) return
    hasSavedRef.current = true
    saveMutation.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoReady])

  // Reports the plain-text version up to Chat.tsx so its copy button copies
  // the recommendations, not this message's raw JSON (see
  // ResponseViewProps.onCopyTextChange).
  useEffect(() => {
    if (data) onCopyTextChange?.(buildCardListCopyText(data.songs.map(buildSongCopyText)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (chatReply) return <DefaultResponse content={chatReply} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />
  if (!data) return <DefaultResponse content={content} toolSlug={toolSlug} chatId={chatId} messageId={messageId} />

  return (
    // pb-2 on top of MessageActions' own mt-2 (see Chat.tsx) puts more gap
    // before the feedback row than sits between cards (space-y-4) — without
    // it, the last song's content butts right up against the feedback
    // icons and reads as if they belong to that song specifically rather
    // than to the whole multi-song response.
    <div className="space-y-4 pb-2">
      {data.songs.map((song, index) => (
        <SongCard key={dedupKey(song)} song={song} video={videos?.[index] ?? undefined} />
      ))}
    </div>
  )
}

export default MusicRecommendationsResponse
