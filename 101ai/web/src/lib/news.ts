import { API_URL, getToken } from './api'

// A real article NewsData.io returned (see api/src/news/news.client.ts) —
// never authored or paraphrased by the model. Shared with lib/items.ts's
// upsertItemSection (News is the only tool that ever passes `articles`).
export interface NewsArticle {
  title: string
  url: string
  sourceName: string
  publishedAt: string
}

// Best-effort from the caller's side too — NewsResponse.tsx just shows no
// "Further reading" section on a failure rather than surfacing an error,
// same as the backend's own best-effort NewsClient.search. `query` should
// be a short real search phrase (the AI's own searchKeywords field, not
// topicTitle/sectionHeading — see tool-config.ts's news entry for why).
// `countryCode` (the user's own ISO 3166-1 alpha-2 country, when known)
// scopes results to real country-tagged articles, confirmed empirically to
// meaningfully improve relevance for a country-specific topic.
export async function fetchNewsArticles(query: string, countryCode?: string | null): Promise<NewsArticle[]> {
  try {
    const url = new URL(`${API_URL}/tools/news/articles`)
    url.searchParams.set('q', query)
    if (countryCode) url.searchParams.set('country', countryCode)
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!response.ok) return []
    const body = await response.json()
    return Array.isArray(body.articles) ? body.articles : []
  } catch {
    return []
  }
}
