import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { getAllItems, type Item } from '../lib/items'
import CompactItemCard from './CompactItemCard'

const PAGE_SIZE = 5

interface ItemPickerSheetProps {
  onClose: () => void
  // No real behavior wired up yet — picking an item doesn't attach it to
  // anything yet, same as this menu's other still-stubbed entries. Callers
  // pass whatever they want to happen on a tap (today: just close).
  onSelect: (item: Item) => void
}

// Same bottom-sheet shell as ItemDetailModal (fixed, items-end, rounded-t-3xl,
// h-[90dvh]) — reused here purely for visual consistency, not the same
// component, since this one lists many items instead of showing one.
function ItemPickerSheet({ onClose, onSelect }: ItemPickerSheetProps) {
  // Already returned updatedAt DESC (see ItemsService.getAllItems) — "recent
  // items" across every tool, not just the one you're currently in, so
  // this is deliberately getAllItems, not getItemsForTool.
  const { data: items = [], isLoading } = useQuery({ queryKey: ['items', 'all'], queryFn: getAllItems })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // "Autoloader" pagination — all items are already fetched in one request
  // (the realistic total is small: free-plan items are capped per tool),
  // this just reveals PAGE_SIZE more of the already-loaded list once the
  // sentinel at the bottom scrolls into view, rather than a real paged API.
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, items.length))
        }
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [items.length])

  const visibleItems = items.slice(0, visibleCount)

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md items-end bg-black/50" onClick={onClose}>
      {/* max-h, not the old fixed h-[90dvh] — hugs its content (shorter
          when there are only a few items) and only grows up to this cap,
          at which point the list below scrolls instead of the sheet
          claiming most of the screen regardless of how much is in it. */}
      <div
        className="relative flex max-h-[65dvh] w-full flex-col rounded-t-3xl bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">Your items</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* min-h-0 — without it, a flex child won't shrink below its
            content size, so overflow-y-auto would never actually kick in
            against the parent's max-h. */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500">No items saved yet.</p>
          ) : (
            <>
              {/* Stacked one-per-row, bigger than the old title-only pill —
                  CompactItemCard's icon square (the item's own tool,
                  colored by its category) sits next to the title so an
                  item's origin tool is still legible at a glance even
                  though this list mixes items from every tool. */}
              <div className="flex flex-col gap-3">
                {visibleItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => onSelect(item)} className="block w-full">
                    <CompactItemCard toolSlug={item.toolSlug} title={item.title} />
                  </button>
                ))}
              </div>
              {visibleCount < items.length && <div ref={sentinelRef} className="h-4" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ItemPickerSheet
