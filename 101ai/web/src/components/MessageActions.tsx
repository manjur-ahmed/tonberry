import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Check, Copy, ThumbsDown, ThumbsUp } from 'lucide-react'
import SaveStatusIndicator from './SaveStatusIndicator'
import type { SaveStatus } from '../tools/responseViews'
import { setMessageFeedback } from '../lib/chats'

interface MessageActionsProps {
  content: string
  saveStatus?: SaveStatus
  // Omitted for a message that can't take feedback yet (e.g. still
  // optimistic, not saved server-side) — the thumbs buttons render disabled
  // rather than firing a PATCH against an id that doesn't exist yet.
  chatId?: string
  messageId?: string
  initialFeedback?: 'up' | 'down' | null
}

function MessageActions({ content, saveStatus, chatId, messageId, initialFeedback = null }: MessageActionsProps) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState(initialFeedback)

  const feedbackMutation = useMutation({
    mutationFn: (next: 'up' | 'down' | null) => {
      if (!chatId || !messageId) throw new Error('Message not saved yet')
      return setMessageFeedback(chatId, messageId, next)
    },
    onError: () => {
      // Best-effort — revert the optimistic toggle on failure rather than
      // leaving the UI claiming a reaction that never actually saved.
      setFeedback(initialFeedback)
    },
  })

  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleFeedback(value: 'up' | 'down') {
    const next = feedback === value ? null : value
    setFeedback(next)
    feedbackMutation.mutate(next)
  }

  const canReact = Boolean(chatId && messageId)

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy response"
        className="text-slate-400 hover:text-slate-600"
      >
        {copied ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('up')}
        disabled={!canReact}
        aria-label="Good response"
        className={feedback === 'up' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600 disabled:opacity-50'}
      >
        <ThumbsUp className="h-4 w-4" strokeWidth={1.75} fill={feedback === 'up' ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('down')}
        disabled={!canReact}
        aria-label="Bad response"
        className={feedback === 'down' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600 disabled:opacity-50'}
      >
        <ThumbsDown className="h-4 w-4" strokeWidth={1.75} fill={feedback === 'down' ? 'currentColor' : 'none'} />
      </button>
      {saveStatus && <SaveStatusIndicator status={saveStatus} />}
    </div>
  )
}

export default MessageActions
