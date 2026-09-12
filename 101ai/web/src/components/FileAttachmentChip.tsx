import { File as FileIcon } from 'lucide-react'

interface FileAttachmentChipProps {
  filename: string
  // Matches CompactItemCard's own compact mode: exactly 64px tall (h-16),
  // for the pending-attachment row where this sits next to an image
  // thumbnail of the same height. Unset (roomier) for a sent message's
  // bubble, which isn't height-constrained against anything else.
  compact?: boolean
}

// A non-image attachment (PDF/Word/Excel/...) has no thumbnail to show —
// just its file icon and name, in place of the <img> an image attachment
// renders as.
function FileAttachmentChip({ filename, compact }: FileAttachmentChipProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white ${compact ? 'h-16 px-3' : 'max-w-full px-4 py-3'}`}
    >
      <FileIcon className="h-5 w-5 flex-shrink-0 text-slate-400" strokeWidth={1.75} />
      <span className={`truncate font-medium text-slate-700 ${compact ? 'max-w-[96px] text-xs' : 'text-sm'}`}>{filename}</span>
    </div>
  )
}

export default FileAttachmentChip
