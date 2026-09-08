import type { ComponentType } from 'react'
import DefaultItemView from './default/ItemView'
import WordHelperItemView from './word-helper/ItemView'
import FilmRecommendationsItemView from './film-recommendations/ItemView'
import BookRecommendationsItemView from './book-recommendations/ItemView'
import MusicRecommendationsItemView from './music-recommendations/ItemView'

export interface ItemViewProps {
  title: string
  data: unknown
}

// Slug -> custom renderer for that tool's saved items. Anything not listed
// here falls back to DefaultItemView (title only).
const itemViews: Record<string, ComponentType<ItemViewProps>> = {
  'word-helper': WordHelperItemView,
  'film-recommendations': FilmRecommendationsItemView,
  'book-recommendations': BookRecommendationsItemView,
  'music-recommendations': MusicRecommendationsItemView,
}

export function getItemView(slug: string): ComponentType<ItemViewProps> {
  return itemViews[slug] ?? DefaultItemView
}
