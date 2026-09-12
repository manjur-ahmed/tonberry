import { useEffect, useRef, useState } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'

export interface OptionsMenuItem {
  label: string
  onClick: () => void
  // Each row gets a leading icon in this design (see the reference menu
  // this was redone from) — optional so a caller can still add a plain,
  // icon-less row if one genuinely doesn't fit anything.
  icon?: LucideIcon
  disabled?: boolean
  // 'danger' for a destructive action (e.g. Delete) — red icon and text.
  tone?: 'default' | 'danger'
}

interface OptionsMenuProps {
  items: OptionsMenuItem[]
  // Lets each usage match its own surroundings — e.g. a small translucent
  // circle floating over an item card vs. a plain icon sitting in a page
  // header — while the dropdown panel itself stays identical everywhere.
  // Defaults to the original item-card trigger style.
  triggerClassName?: string
  iconClassName?: string
}

const DEFAULT_TRIGGER_CLASSNAME =
  'flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm'
const DEFAULT_ICON_CLASSNAME = 'h-4 w-4'

// The "⋮" trigger + dropdown panel for a per-item/per-page options menu —
// pulled out so every place that needs one (ToolDashboard's item cards,
// NoteEditor's header) looks and behaves identically instead of each
// re-implementing its own toggle and panel styling. Each instance owns its
// own open state — opening one doesn't close another elsewhere on the page.
//
// The panel is anchored top-0/right-0, flush with the trigger's own corner
// rather than offset below it (top-full) — deliberately overlapping and
// covering the trigger once open, the way a native context menu does,
// instead of leaving it sitting exposed above the panel.
function OptionsMenu({ items, triggerClassName, iconClassName }: OptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setIsOpen((open) => !open)
        }}
        aria-label="More options"
        className={triggerClassName ?? DEFAULT_TRIGGER_CLASSNAME}
      >
        <MoreVertical className={iconClassName ?? DEFAULT_ICON_CLASSNAME} strokeWidth={1.75} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-0 z-20 min-w-[200px] overflow-hidden rounded-3xl border border-white/40 bg-white/40 shadow-2xl backdrop-blur-3xl">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setIsOpen(false)
                  item.onClick()
                }}
                disabled={item.disabled}
                className={`flex w-full items-center gap-3 whitespace-nowrap px-5 py-3.5 text-left text-base font-normal disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.tone === 'danger' ? 'text-red-600' : 'text-slate-900'
                }`}
              >
                {Icon && <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />}
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default OptionsMenu
