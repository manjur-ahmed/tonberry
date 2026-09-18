import { Pin } from 'lucide-react'

function DefaultItemView({ title, pinned }: { title: string; data: unknown; pinned?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {/* Always rendered, not just when pinned — a 2-column grid row with
          one pinned and one unpinned card would otherwise mismatch height. */}
      <div className="mb-1 text-slate-400">{pinned ? <Pin className="h-3.5 w-3.5" strokeWidth={1.75} /> : ' '}</div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
    </div>
  )
}

export default DefaultItemView
