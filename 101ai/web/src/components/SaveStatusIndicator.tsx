import { CircleCheck, CircleX, Loader2 } from 'lucide-react'
import type { SaveStatus } from '../tools/responseViews'

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <Loader2 className="h-4 w-4 animate-spin text-slate-400" strokeWidth={1.75} aria-label="Saving item" />
    )
  }
  if (status === 'saved') {
    return <CircleCheck className="h-4 w-4 text-emerald-500" strokeWidth={1.75} aria-label="Item saved" />
  }
  return <CircleX className="h-4 w-4 text-red-500" strokeWidth={1.75} aria-label="Item not saved" />
}

export default SaveStatusIndicator
