import { useEffect, useState } from 'react'

const WAIT_SECONDS = 5

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS)

  useEffect(() => {
    if (!open) return
    setSecondsLeft(WAIT_SECONDS)
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [open])

  if (!open) return null

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 pb-8 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
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
