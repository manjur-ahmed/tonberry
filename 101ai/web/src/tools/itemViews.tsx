import type { ComponentType } from 'react'
import DefaultItemView from './default/ItemView'
import WordHelperItemView from './word-helper/ItemView'
import FilmRecommendationsItemView from './film-recommendations/ItemView'
import BookRecommendationsItemView from './book-recommendations/ItemView'
import MusicRecommendationsItemView from './music-recommendations/ItemView'
import QuoteFinderItemView from './quote-finder/ItemView'
import StoryExplainerItemView from './story-explainer/ItemView'
import TopicExplainerItemView from './topic-explainer/ItemView'
import CookingItemView from './cooking/ItemView'
import DietItemView from './diet/ItemView'
import SelfCareItemView from './self-care/ItemView'
import TechItemView from './tech/ItemView'

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
  'quote-finder': QuoteFinderItemView,
  'story-explainer': StoryExplainerItemView,
  'science-explainer': TopicExplainerItemView,
  'history-helper': TopicExplainerItemView,
  'cooking': CookingItemView,
  'diet': DietItemView,
  'self-care': SelfCareItemView,
  'tech': TechItemView,
  'politics': TopicExplainerItemView,
}

export function getItemView(slug: string): ComponentType<ItemViewProps> {
  return itemViews[slug] ?? DefaultItemView
}
