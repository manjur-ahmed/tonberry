import type { ComponentType } from 'react'
import DefaultItemView from './default/ItemView'
import WordHelperItemView from './word-helper/ItemView'

export interface ItemViewProps {
  title: string
  data: unknown
}

// Slug -> custom renderer for that tool's saved items. Anything not listed
// here falls back to DefaultItemView (title only).
const itemViews: Record<string, ComponentType<ItemViewProps>> = {
  'word-helper': WordHelperItemView,
}

export function getItemView(slug: string): ComponentType<ItemViewProps> {
  return itemViews[slug] ?? DefaultItemView
}
