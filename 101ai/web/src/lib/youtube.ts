import { API_URL, getToken } from './api'

// A real video the YouTube Data API returned (see api/src/youtube/
// youtube.client.ts) — never authored or paraphrased by the model. Shared
// with lib/items.ts's upsertItemSection (science-explainer/history-helper/
// politics are the only tools that ever pass `video`).
export interface YoutubeVideo {
  videoId: string
  title: string
  channelTitle: string
}

// Best-effort from the caller's side too — every ResponseView that supports
// video just shows no embed on a failure rather than surfacing an error,
// same as the backend's own best-effort YoutubeClient.search. `query`
// should be a short real search phrase (the AI's own videoKeywords field,
// never a full sentence — see tool-config.ts's VIDEO_KEYWORDS_GUIDANCE).
export async function fetchYoutubeVideo(query: string): Promise<YoutubeVideo | null> {
  try {
    const url = new URL(`${API_URL}/tools/youtube/search`)
    url.searchParams.set('q', query)
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!response.ok) return null
    const body = await response.json()
    return body.video ?? null
  } catch {
    return null
  }
}
