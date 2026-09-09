import type { ComponentType } from 'react'
import DefaultItemView from './default/ItemView'
import WordHelperItemView from './word-helper/ItemView'
import FilmRecommendationsItemView from './film-recommendations/ItemView'
import BookRecommendationsItemView from './book-recommendations/ItemView'
import MusicRecommendationsItemView from './music-recommendations/ItemView'
import QuoteFinderItemView from './quote-finder/ItemView'
import StoryExplainerItemView from './story-explainer/ItemView'
import ScienceExplainerItemView from './science-explainer/ItemView'
import HistoryHelperItemView from './history-helper/ItemView'
import CookingItemView from './cooking/ItemView'
import DietItemView from './diet/ItemView'
import SelfCareItemView from './self-care/ItemView'
import TechItemView from './tech/ItemView'
import HomeItemView from './home/ItemView'
import CarItemView from './car/ItemView'
import DiyItemView from './diy/ItemView'
import PoliticsItemView from './politics/ItemView'
import GeneralHealthItemView from './general-health/ItemView'

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
  'science-explainer': ScienceExplainerItemView,
  'history-helper': HistoryHelperItemView,
  'cooking': CookingItemView,
  'diet': DietItemView,
  'self-care': SelfCareItemView,
  'tech': TechItemView,
  'home': HomeItemView,
  'car': CarItemView,
  'diy': DiyItemView,
  'politics': PoliticsItemView,
  'general-health': GeneralHealthItemView,
}

export function getItemView(slug: string): ComponentType<ItemViewProps> {
  return itemViews[slug] ?? DefaultItemView
}
