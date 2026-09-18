import { useEffect, useState } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  // Forces a delay before the confirm button becomes clickable — for an
  // account-wide destructive action (Settings' "delete account"/"reset
  // chats"/"remove items", wiping ALL of something at once) where a slower,
  // more deliberate confirm is worth the friction. Defaults to 0 (no wait)
  // for an ordinary single-item/chat delete, which doesn't need it.
  waitSeconds?: number
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  waitSeconds = 0,
}: ConfirmDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(waitSeconds)

  useEffect(() => {
    if (!open) return
    setSecondsLeft(waitSeconds)
    if (waitSeconds <= 0) return
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [open, waitSeconds])

  if (!open) return null

  return (
    // fixed, not absolute — see ItemDetailModal for why (pins to the real
    // viewport instead of the whole scrollable page). onClick={onCancel}
    // here, stopPropagation on the panel below — same backdrop-dismiss
    // pattern as ItemDetailModal.
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-md items-end justify-center bg-slate-900/40 px-4 pb-8 sm:items-center"
      onClick={onCancel}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={secondsLeft > 0}
            onClick={onConfirm}
            className="w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {secondsLeft > 0 ? `${confirmLabel} (${secondsLeft})` : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-full border border-slate-300 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
