import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, File, Image, ImagePlus, Pencil, Plus, type LucideIcon } from 'lucide-react'

export interface AttachmentMenuItem {
  label: string
  icon: LucideIcon
  onClick: () => void
  disabled?: boolean
}

interface AttachmentMenuProps {
  // Rendered as separate blocks with a divider between them, matching the
  // reference menu's "Camera/Photos/Files" vs "Create image/Edit image"
  // split. Defaults to that same set — nothing behind any of them yet
  // (no camera/file picker or image-gen endpoint), same as the plain
  // attach button before this had a menu at all.
  groups?: AttachmentMenuItem[][]
  triggerClassName?: string
  iconClassName?: string
  triggerTabIndex?: number
}

const DEFAULT_TRIGGER_CLASSNAME =
  'flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500'
const DEFAULT_ICON_CLASSNAME = 'h-4 w-4'

const DEFAULT_GROUPS: AttachmentMenuItem[][] = [
  [
    { label: 'Camera', icon: Camera, onClick: () => {} },
    { label: 'Photos', icon: Image, onClick: () => {} },
    { label: 'Files', icon: File, onClick: () => {} },
  ],
  [
    { label: 'Create image', icon: ImagePlus, onClick: () => {} },
    { label: 'Edit image', icon: Pencil, onClick: () => {} },
  ],
]

// Rendered through a portal, not just absolute-positioned in place like
// OptionsMenu — this trigger can sit inside an ancestor that clips
// overflow for its own reasons (NoteEditor's attach button lives in a
// wrapper that animates width/opacity to 0 on focus, which needs
// overflow-hidden to look right, and that would otherwise clip this panel
// too). Portaling to document.body sidesteps that, positioned from the
// trigger's own measured position rather than CSS anchoring. Opens
// upward (bottom-anchored) since the trigger always sits low on screen,
// in a compose bar near the bottom.
function AttachmentMenu({ groups = DEFAULT_GROUPS, triggerClassName, iconClassName, triggerTabIndex }: AttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; bottom: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        tabIndex={triggerTabIndex}
        onClick={(event) => {
          event.stopPropagation()
          if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()
            setPosition({ left: rect.left, bottom: window.innerHeight - rect.top + 8 })
          }
          setIsOpen((open) => !open)
        }}
        aria-label="Attach"
        className={triggerClassName ?? DEFAULT_TRIGGER_CLASSNAME}
      >
        <Plus className={iconClassName ?? DEFAULT_ICON_CLASSNAME} strokeWidth={1.75} />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ left: position.left, bottom: position.bottom }}
            className="fixed z-50 min-w-[220px] divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl"
          >
            {groups.map((group, groupIndex) => (
              <div key={groupIndex} className="py-1">
                {group.map((item) => {
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
                      className="flex w-full items-center gap-3 whitespace-nowrap px-4 py-3 text-left text-base font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      {item.label}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

export default AttachmentMenu
