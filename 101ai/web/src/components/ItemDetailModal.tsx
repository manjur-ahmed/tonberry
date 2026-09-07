import { X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { Item } from '../lib/items'
import { startChatFromItem } from '../lib/chats'
import { getResponseView } from '../tools/responseViews'

function ItemDetailModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const ResponseView = getResponseView(item.toolSlug)
  const navigate = useNavigate()

  // Creates the chat (item card + canned opener, no OpenAI call — see
  // ChatsService.createChatFromItem) and jumps straight to it.
  const startChatMutation = useMutation({
    mutationFn: () => startChatFromItem(item.id),
    onSuccess: (result) => {
      if (result.type !== 'reply') return
      navigate(`/tools/${item.toolSlug}/chats/${result.chat.id}`)
    },
  })

  return (
    // fixed (not absolute) — this must pin to the actual viewport, not to
    // Layout's full-page-height positioned ancestor. absolute here meant
    // "top: 0" was the top of the whole scrollable page, so opening this
    // while scrolled down landed the sheet's close button above the
    // visible area entirely. mx-auto + max-w-md keeps it inside the
    // phone-frame column instead of going full-bleed on a wide viewport.
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md items-end bg-black/50" onClick={onClose}>
      <div
        // dvh, not vh — vh is iOS Safari's largest (chrome-collapsed)
        // viewport, taller than what's actually visible with the address
        // bar showing, which pushed the sheet further past the top edge.
        className="relative flex h-[90dvh] w-full flex-col rounded-t-3xl bg-white"
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
            messageId={item.id}
            readOnly
          />
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          {startChatMutation.isError && (
            <p className="mb-2 text-center text-sm text-red-600">Couldn&rsquo;t start a chat — try again.</p>
          )}
          <button
            type="button"
            onClick={() => startChatMutation.mutate()}
            disabled={startChatMutation.isPending}
            className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {startChatMutation.isPending ? 'Starting chat…' : 'Start a chat about this'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ItemDetailModal
