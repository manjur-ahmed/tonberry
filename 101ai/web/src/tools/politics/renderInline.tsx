import type { ReactNode } from 'react'

// The only markup this tool is ever asked to produce (see tool-config.ts's
// formattingInstruction) — bolding law/act names with **double asterisks**.
// Deliberately not a full markdown parser (no headers/lists/links) — this
// app has no other use for one, so a small regex pass is enough rather than
// pulling in a dependency for two inline styles.
export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {match[1]}
        </strong>,
      )
    } else {
      nodes.push(<em key={key++}>{match[2]}</em>)
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}
