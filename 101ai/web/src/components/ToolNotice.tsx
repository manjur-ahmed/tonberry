import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'

interface ToolNoticeProps {
  icon: ComponentType<LucideProps>
  message: ReactNode
}

// Small icon + message banner, rounded with a border (no shadow) — shared
// by ToolDashboard's new-chat compose sheet (the tool's own liability
// `warning`, see registry.ts) and Chat.tsx's reply box (the memory promo
// notice) rather than each rolling its own near-identical box.
function ToolNotice({ icon: Icon, message }: ToolNoticeProps) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      <Icon className="h-4 w-4 flex-shrink-0 text-slate-400" strokeWidth={1.75} />
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  )
}

export default ToolNotice
