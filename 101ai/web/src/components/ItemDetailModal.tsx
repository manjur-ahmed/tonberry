import { useState } from 'react'
import { ChevronUp, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { Item } from '../lib/items'
import { startChatFromItem } from '../lib/chats'
import { getResponseView } from '../tools/responseViews'
import { categories, getTool, tools, type Tool } from '../tools/registry'
import ToolCard from './ToolCard'

// 'destination' is the "open in [tool] chat" vs "open in another tool"
// choice; 'tool-picker' is the tool grid shown after picking the latter —
// it replaces the destination sheet rather than stacking on top of it, so
// closing the tool picker goes straight back to the item detail sheet, not
// through the destination choice again.
type Step = 'closed' | 'destination' | 'tool-picker'

function ItemDetailModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const ResponseView = getResponseView(item.toolSlug)
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('closed')
  const ownTool = getTool(item.toolSlug)

  // Creates the chat (item card + canned opener, no OpenAI call — see
  // ChatsService.createChatFromItem) and jumps straight to it. Passing a
  // targetToolSlug sends the item to a different tool than the one it was
  // saved from; omitting it (the "open in [tool] chat" choice) keeps it in
  // the item's own tool, same as before this flow existed.
  const startChatMutation = useMutation({
    mutationFn: (targetToolSlug?: string) => startChatFromItem(item.id, targetToolSlug),
    onSuccess: (result) => {
      if (result.type !== 'reply') return
      // result.chat.toolSlug, not item.toolSlug/targetToolSlug — the chat
      // that was actually created is the source of truth for where it lives.
      navigate(`/tools/${result.chat.toolSlug}/chats/${result.chat.id}`)
    },
  })

  function close() {
    setStep('closed')
  }

  return (
    <>
      {/* fixed (not absolute) — this must pin to the actual viewport, not to
          Layout's full-page-height positioned ancestor. absolute here meant
          "top: 0" was the top of the whole scrollable page, so opening this
          while scrolled down landed the sheet's close button above the
          visible area entirely. mx-auto + max-w-md keeps it inside the
          phone-frame column instead of going full-bleed on a wide viewport. */}
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
            {startChatMutation.isError && step === 'closed' && (
              <p className="mb-2 text-center text-sm text-red-600">Couldn&rsquo;t start a chat — try again.</p>
            )}
            <button
              type="button"
              onClick={() => setStep('destination')}
              disabled={startChatMutation.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {startChatMutation.isPending ? 'Starting chat…' : 'Start a chat about this'}
              <ChevronUp className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {step === 'destination' && (
        <ChatDestinationSheet
          toolName={ownTool?.name ?? item.toolSlug}
          isPending={startChatMutation.isPending}
          isError={startChatMutation.isError}
          onOpenOwnTool={() => startChatMutation.mutate(undefined)}
          onOpenAnotherTool={() => setStep('tool-picker')}
          onClose={close}
        />
      )}

      {step === 'tool-picker' && (
        <ToolPickerSheet
          isPending={startChatMutation.isPending}
          isError={startChatMutation.isError}
          onSelect={(tool) => startChatMutation.mutate(tool.slug)}
          onClose={close}
        />
      )}
    </>
  )
}

interface ChatDestinationSheetProps {
  toolName: string
  isPending: boolean
  isError: boolean
  onOpenOwnTool: () => void
  onOpenAnotherTool: () => void
  onClose: () => void
}

function ChatDestinationSheet({ toolName, isPending, isError, onOpenOwnTool, onOpenAnotherTool, onClose }: ChatDestinationSheetProps) {
  return (
    // Same shell as the item detail sheet and the tool picker below it —
    // edge-to-edge, rounded-t-3xl, its own X — just auto-height instead of
    // h-[90dvh] since there's only two buttons' worth of content.
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md items-end bg-black/50" onClick={onClose}>
      <div className="relative flex w-full flex-col rounded-t-3xl bg-white" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end px-4 pt-4">
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 pb-8">
          {isError && <p className="mb-2 text-center text-sm text-red-600">Couldn&rsquo;t start a chat — try again.</p>}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onOpenAnotherTool}
              disabled={isPending}
              className="w-full rounded-full border border-slate-300 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Open in another tool
            </button>
            <button
              type="button"
              onClick={onOpenOwnTool}
              disabled={isPending}
              className="w-full rounded-full bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Open in {toolName} chat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ToolPickerSheetProps {
  isPending: boolean
  isError: boolean
  onSelect: (tool: Tool) => void
  onClose: () => void
}

function ToolPickerSheet({ isPending, isError, onSelect, onClose }: ToolPickerSheetProps) {
  return (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-md items-end bg-black/50" onClick={onClose}>
      {/* Same height as the item detail sheet underneath it, and the same
          categorised, horizontally-scrolling tile layout as the homepage's
          Browse Tools section — see Home.tsx. */}
      <div
        className="relative flex h-[90dvh] w-full flex-col rounded-t-3xl bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Open in another tool</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {isError && <p className="mt-2 px-6 text-center text-sm text-red-600">Couldn&rsquo;t start a chat — try again.</p>}

        {/* @container — the horizontal-scroll rows below size each card off
            this box's own width (cqw), matching Home.tsx's own tile sizing. */}
        <div className="@container flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-8">
            {categories.map((category) => {
              const items = tools.filter((tool) => tool.category === category)
              if (items.length === 0) return null

              return (
                <div key={category}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</h3>
                  <div className="-mx-6 mt-3 flex gap-6 overflow-x-auto px-6 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {items.map((tool) => (
                      <div key={tool.slug} className="h-[170px] w-[calc((100cqw-5rem)/2)] flex-shrink-0">
                        <ToolCard tool={tool} onSelect={onSelect} disabled={isPending} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ItemDetailModal
