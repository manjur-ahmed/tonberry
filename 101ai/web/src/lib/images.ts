import { API_URL, getToken } from './api'

// A real poster/cover image one of the images.controller.ts endpoints
// resolved — never a URL the model invents. `source` names which real API
// it came from (Wikipedia/Google Books/AniList), shown as a small
// attribution caption wherever the image is rendered.
export interface RecommendationImage {
  url: string
  source: 'Wikipedia' | 'Google Books' | 'AniList'
}

async function fetchImage(path: string, params: Record<string, string | null>): Promise<RecommendationImage | null> {
  try {
    const url = new URL(`${API_URL}${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value)
    }
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (!response.ok) return null
    const body = await response.json()
    return body.image ?? null
  } catch {
    return null
  }
}

export function fetchMovieImage(title: string, year: string | null): Promise<RecommendationImage | null> {
  return fetchImage('/tools/images/movie', { title, year })
}

export function fetchShowImage(title: string, year: string | null): Promise<RecommendationImage | null> {
  return fetchImage('/tools/images/show', { title, year })
}

export function fetchBookImage(title: string, author: string | null): Promise<RecommendationImage | null> {
  return fetchImage('/tools/images/book', { title, author })
}

export function fetchMangaImage(title: string): Promise<RecommendationImage | null> {
  return fetchImage('/tools/images/manga', { title })
}
