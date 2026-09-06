import { X } from 'lucide-react'
import type { Item } from '../lib/items'
import { getResponseView } from '../tools/responseViews'

function ItemDetailModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const ResponseView = getResponseView(item.toolSlug)

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="relative flex h-[90vh] w-full flex-col rounded-t-3xl bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end px-4 pt-4">
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <ResponseView
            content={JSON.stringify(item.data)}
            toolSlug={item.toolSlug}
            chatId={item.chatId ?? ''}
            readOnly
          />
        </div>
      </div>
    </div>
  )
}

export default ItemDetailModal
