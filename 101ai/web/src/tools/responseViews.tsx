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
import GymPlannerResponse from './gym-planner/ResponseView'
import BusinessPlanResponse from './business-plan/ResponseView'
import BusinessResearchResponse from './business-research/ResponseView'
import SalaryCalculatorResponse from './salary-calculator/ResponseView'
import ActivityFinderResponse from './day-activity/ResponseView'
import HolidayPlanningResponse from './holiday-planning/ResponseView'
import EventPlannerResponse from './event-planner/ResponseView'
import AdCreatorResponse from './ad-creator/ResponseView'
import CareerPlannerResponse from './career-planner/ResponseView'
import BudgetPlannerResponse from './budget-planner/ResponseView'

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
  // `content` is always the raw JSON reply — fine for most tools (nobody
  // needs to paste a diet plan's JSON elsewhere), but wrong for a tool
  // whose whole point is a copy-pasteable result (see ad-creator). A
  // ResponseView that renders something meant to be copied as plain text
  // reports the human-readable version here; MessageActions' copy button
  // uses it instead of raw content when set. Most tools never call this,
  // which is fine — undefined leaves the raw-content fallback untouched.
  onCopyTextChange?: (text: string | null) => void
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
  'gym-planner': GymPlannerResponse,
  'business-plan': BusinessPlanResponse,
  'business-research': BusinessResearchResponse,
  'salary-calculator': SalaryCalculatorResponse,
  'day-activity': ActivityFinderResponse,
  'holiday-planning': HolidayPlanningResponse,
  'event-planner': EventPlannerResponse,
  'ad-creator': AdCreatorResponse,
  'career-planner': CareerPlannerResponse,
  'budget-planner': BudgetPlannerResponse,
}

export function getResponseView(slug: string): ComponentType<ResponseViewProps> {
  return responseViews[slug] ?? DefaultResponse
}
