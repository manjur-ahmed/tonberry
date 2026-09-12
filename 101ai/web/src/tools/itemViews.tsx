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
import GymPlannerItemView from './gym-planner/ItemView'
import BusinessPlanItemView from './business-plan/ItemView'
import BusinessResearchItemView from './business-research/ItemView'
import SalaryCalculatorItemView from './salary-calculator/ItemView'
import ActivityFinderItemView from './day-activity/ItemView'
import HolidayPlanningItemView from './holiday-planning/ItemView'
import EventPlannerItemView from './event-planner/ItemView'
import AdCreatorItemView from './ad-creator/ItemView'
import CareerPlannerItemView from './career-planner/ItemView'
import BudgetPlannerItemView from './budget-planner/ItemView'
import WriterItemView from './writer/ItemView'

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
  'gym-planner': GymPlannerItemView,
  'business-plan': BusinessPlanItemView,
  'business-research': BusinessResearchItemView,
  'salary-calculator': SalaryCalculatorItemView,
  'day-activity': ActivityFinderItemView,
  'holiday-planning': HolidayPlanningItemView,
  'event-planner': EventPlannerItemView,
  'ad-creator': AdCreatorItemView,
  'career-planner': CareerPlannerItemView,
  'budget-planner': BudgetPlannerItemView,
  'writer': WriterItemView,
}

export function getItemView(slug: string): ComponentType<ItemViewProps> {
  return itemViews[slug] ?? DefaultItemView
}
