// Shared plain-text builders for ResponseViewProps.onCopyTextChange — see
// ad-creator/ResponseView.tsx's buildCopyText for the pattern this
// generalizes. Several tools share an identical parsed-JSON shape (see
// tool-config.ts), so rather than one bespoke builder per tool, each shape
// gets one builder here and every tool with that shape just calls it.

// tech/home/car/diy: {guideKey, guideTitle, steps: string[]}
export function buildGuideCopyText(title: string, steps: string[]): string {
  return [title, '', ...steps.map((step, index) => `${index + 1}. ${step}`)].join('\n')
}

// diet/self-care/gym-planner/salary-calculator/budget-planner/holiday-planning:
// {planKey, planTitle, columns: string[], rows: string[][], note?: string | null}.
// Mirrors DietResponse's formatRow logic — every column but the last becomes
// a label prefix, the last column is the value.
export function buildPlanTableCopyText(
  title: string,
  columns: string[],
  rows: string[][],
  note?: string | null,
): string {
  const lines = rows.map((row) => {
    if (columns.length <= 1) return `- ${row[0] ?? ''}`
    const label = row.slice(0, -1).join(' – ')
    const value = row[row.length - 1] ?? ''
    return `- ${label}: ${value}`
  })
  return [title, '', ...lines, ...(note ? ['', note] : [])].join('\n')
}

// business-plan/event-planner (a plan that's always the complete current
// document, no turn/document duality), and the topic-explainer group's full
// TopicDocument case: {title, sections: {heading, body}[]}.
export function buildSectionsCopyText(title: string, sections: { heading: string; body: string }[]): string {
  return [title, '', ...sections.flatMap((section) => [section.heading, section.body, ''])].join('\n').trim()
}

// The topic-explainer group's single-turn case (science-explainer,
// history-helper, politics, bills-utilities, general-health,
// business-research, career-planner, news): one heading/body, no title.
export function buildTopicTurnCopyText(heading: string, body: string): string {
  return [heading, '', body].join('\n')
}

// film-recommendations/book-recommendations/music-recommendations/
// quote-finder/day-activity: several independent per-card blocks, one
// message per envelope of cards.
export function buildCardListCopyText(cards: string[]): string {
  return cards.join('\n\n---\n\n')
}
