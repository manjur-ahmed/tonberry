import type { ComponentType } from 'react'
import DefaultResponse from './default/ResponseView'
import WordHelperResponse from './word-helper/ResponseView'
import FilmRecommendationsResponse from './film-recommendations/ResponseView'
import BookRecommendationsResponse from './book-recommendations/ResponseView'
import MusicRecommendationsResponse from './music-recommendations/ResponseView'
import StoryExplainerResponse from './story-explainer/ResponseView'
import QuoteFinderResponse from './quote-finder/ResponseView'
import ScienceExplainerResponse from './science-explainer/ResponseView'
import HistoryHelperResponse from './history-helper/ResponseView'
import CookingResponse from './cooking/ResponseView'
import DietResponse from './diet/ResponseView'
import SelfCareResponse from './self-care/ResponseView'
import TechResponse from './tech/ResponseView'
import HomeResponse from './home/ResponseView'
import CarResponse from './car/ResponseView'
import DiyResponse from './diy/ResponseView'
import PoliticsResponse from './politics/ResponseView'
import GeneralHealthResponse from './general-health/ResponseView'

export type SaveStatus = 'saving' | 'saved' | 'error' | 'limit-reached'

export interface ResponseViewProps {
  content: string
  toolSlug: string
  chatId: string
  // The message this reply belongs to — tools that auto-save an item (see
  // word-helper) use this to remember locally that this specific message's
  // item was already saved, so reopening the chat later shows it as saved
  // rather than re-running the save (and re-showing a spinner/failure) for
  // every historical message.
  messageId: string
  // Set when rendering an already-saved item for viewing only — tools that
  // auto-save on mount (see word-helper) should skip that side effect here.
  readOnly?: boolean
  // Tools that save an item as part of rendering (see word-helper) report
  // their save mutation's progress here so a sibling MessageActions can
  // show a status indicator next to the dislike button.
  onSaveStatusChange?: (status: SaveStatus) => void
}

// Slug -> custom renderer for that tool's AI replies. Anything not listed
// here falls back to DefaultResponse (plain text).
const responseViews: Record<string, ComponentType<ResponseViewProps>> = {
  'word-helper': WordHelperResponse,
  'film-recommendations': FilmRecommendationsResponse,
  'book-recommendations': BookRecommendationsResponse,
  'music-recommendations': MusicRecommendationsResponse,
  'story-explainer': StoryExplainerResponse,
  'quote-finder': QuoteFinderResponse,
  'science-explainer': ScienceExplainerResponse,
  'history-helper': HistoryHelperResponse,
  'cooking': CookingResponse,
  'diet': DietResponse,
  'self-care': SelfCareResponse,
  'tech': TechResponse,
  'home': HomeResponse,
  'car': CarResponse,
  'diy': DiyResponse,
  'politics': PoliticsResponse,
  'general-health': GeneralHealthResponse,
}

export function getResponseView(slug: string): ComponentType<ResponseViewProps> {
  return responseViews[slug] ?? DefaultResponse
}
